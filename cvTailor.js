const Anthropic = require('@anthropic-ai/sdk').default;
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        BorderStyle, TabStopType, TabStopPosition } = require('docx');
const config = require('./config');

class CVTailor {
  constructor() {
    this.client = new Anthropic({ apiKey: config.claude.apiKey });
    this.cvText = '';
    this._loadCV();
  }

  _loadCV() {
    try {
      this.cvText = fs.readFileSync(config.paths.masterCvText, 'utf-8');
      console.log('[CVTailor] Loaded master CV');
    } catch (e) {
      console.error('[CVTailor] Could not load master CV text');
    }
  }

  /**
   * Use Claude to generate tailored CV content
   */
  async _generateTailoredContent(job) {
    const response = await this.client.messages.create({
      model: config.claude.model,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are an expert resume writer. Tailor this CV for the specific job below.

MASTER CV:
${this.cvText}

TARGET JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description.substring(0, 2000)}

INSTRUCTIONS:
1. Keep ALL factual information from the master CV (don't invent experience)
2. Reorder and emphasize skills/experiences that match the job
3. Adjust the professional summary to target this specific role
4. Use keywords from the job description naturally
5. Keep it concise (max 2 pages worth of content)

Respond ONLY with valid JSON in this exact structure:
{
  "name": "Full Name",
  "email": "email",
  "phone": "phone",
  "location": "city, country",
  "linkedin": "linkedin url or empty string",
  "github": "github url or empty string",
  "summary": "2-3 sentence professional summary tailored to this role",
  "skills": ["skill1", "skill2", "..."],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "period": "Start - End",
      "bullets": ["achievement 1", "achievement 2", "achievement 3"]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "institution": "School Name",
      "year": "Year"
    }
  ],
  "certifications": ["cert1", "cert2"]
}`,
      }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude did not return valid JSON');
    return JSON.parse(jsonMatch[0]);
  }

  /**
   * Build a professional DOCX from structured CV data
   */
  async _buildDocx(cvData, job) {
    const accentColor = '2B579A'; // Professional blue

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'Calibri', size: 22, color: '333333' },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 720, right: 1080, bottom: 720, left: 1080 },
          },
        },
        children: [
          // NAME
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: cvData.name || 'Your Name',
                bold: true,
                size: 36,
                font: 'Calibri',
                color: accentColor,
              }),
            ],
          }),

          // CONTACT INFO
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: [cvData.email, cvData.phone, cvData.location]
                  .filter(Boolean).join('  |  '),
                size: 18,
                color: '666666',
              }),
            ],
          }),

          // LINKS
          ...(cvData.linkedin || cvData.github ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [
                new TextRun({
                  text: [cvData.linkedin, cvData.github].filter(Boolean).join('  |  '),
                  size: 18,
                  color: '666666',
                }),
              ],
            }),
          ] : []),

          // DIVIDER
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: accentColor, space: 1 },
            },
            spacing: { after: 200 },
            children: [],
          }),

          // SUMMARY
          this._sectionHeading('PROFESSIONAL SUMMARY', accentColor),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: cvData.summary || '', size: 22 }),
            ],
          }),

          // SKILLS
          this._sectionHeading('TECHNICAL SKILLS', accentColor),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: (cvData.skills || []).join('  •  '),
                size: 20,
              }),
            ],
          }),

          // EXPERIENCE
          this._sectionHeading('PROFESSIONAL EXPERIENCE', accentColor),
          ...(cvData.experience || []).flatMap(exp => [
            new Paragraph({
              spacing: { before: 120, after: 40 },
              children: [
                new TextRun({ text: exp.title, bold: true, size: 24 }),
                new TextRun({ text: `  —  ${exp.company}`, size: 22, color: '555555' }),
              ],
            }),
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({ text: exp.period, size: 20, color: '888888', italics: true }),
              ],
            }),
            ...(exp.bullets || []).map(bullet =>
              new Paragraph({
                spacing: { after: 40 },
                indent: { left: 360 },
                children: [
                  new TextRun({ text: `▸  ${bullet}`, size: 20 }),
                ],
              })
            ),
          ]),

          // EDUCATION
          this._sectionHeading('EDUCATION', accentColor),
          ...(cvData.education || []).map(edu =>
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({ text: edu.degree, bold: true, size: 22 }),
                new TextRun({ text: `  —  ${edu.institution}`, size: 22, color: '555555' }),
                new TextRun({ text: `  (${edu.year})`, size: 20, color: '888888' }),
              ],
            })
          ),

          // CERTIFICATIONS
          ...(cvData.certifications && cvData.certifications.length > 0 ? [
            this._sectionHeading('CERTIFICATIONS', accentColor),
            ...cvData.certifications.map(cert =>
              new Paragraph({
                spacing: { after: 40 },
                indent: { left: 360 },
                children: [
                  new TextRun({ text: `▸  ${cert}`, size: 20 }),
                ],
              })
            ),
          ] : []),
        ],
      }],
    });

    return Packer.toBuffer(doc);
  }

  _sectionHeading(text, color) {
    return new Paragraph({
      spacing: { before: 240, after: 100 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 2, color: color, space: 1 },
      },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 24,
          color: color,
          font: 'Calibri',
          characterSpacing: 60,
        }),
      ],
    });
  }

  /**
   * Generate a tailored cover email using Claude
   */
  async generateCoverEmail(job) {
    const response = await this.client.messages.create({
      model: config.claude.model,
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Write a concise, professional cover email for this job application.

MY BACKGROUND:
${this.cvText.substring(0, 1500)}

JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description.substring(0, 1000)}

RULES:
- Keep it under 200 words
- Be specific about why I'm a good fit (reference actual skills/experience from my CV)
- Sound human, not generic
- Include a clear call to action
- Do NOT include subject line — just the email body
- Start with a greeting and end with my name
- Use the name from my CV

Respond with ONLY the email text, nothing else.`,
      }],
    });

    return response.content[0].text.trim();
  }

  /**
   * Main method: tailor CV and generate email for a job
   */
  async tailorForJob(job) {
    console.log(`[CVTailor] Tailoring CV for: ${job.title} @ ${job.company}`);

    // Generate tailored content using Claude
    const cvData = await this._generateTailoredContent(job);

    // Build DOCX
    const docxBuffer = await this._buildDocx(cvData, job);

    // Save to file
    const sanitizedName = `${cvData.name || 'CV'}_${job.company}`.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `CV_${sanitizedName}.docx`;
    const filepath = path.join('data', filename);

    fs.writeFileSync(filepath, docxBuffer);
    console.log(`[CVTailor] Saved tailored CV: ${filepath}`);

    // Generate cover email
    const coverEmail = await this.generateCoverEmail(job);
    console.log('[CVTailor] Generated cover email');

    return {
      cvPath: filepath,
      cvFilename: filename,
      coverEmail,
      cvData,
    };
  }
}

module.exports = CVTailor;
