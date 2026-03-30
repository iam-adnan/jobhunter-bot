const axios = require('axios');
const fs = require('fs');
const config = require('./config');

class JobRanker {
  constructor() {
    this.cvText = '';
    this._loadCV();
  }

  _loadCV() {
    try {
      this.cvText = fs.readFileSync(config.paths.masterCvText, 'utf-8');
      console.log('[Ranker] Loaded master CV text');
    } catch (e) {
      console.error('[Ranker] Could not load master CV text. Create', config.paths.masterCvText);
    }
  }

  /**
   * Call Ollama locally (completely free)
   */
  async _callOllama(prompt) {
    try {
      const { data } = await axios.post(`${config.ollama.url}/api/generate`, {
        model: config.ollama.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 500,
        },
      }, { timeout: 60000 });

      return data.response || '';
    } catch (err) {
      console.error('[Ollama] Error:', err.message);
      throw err;
    }
  }

  /**
   * Score a single job against the CV using Ollama
   */
  async _scoreJob(job) {
    const prompt = `You are a job matching expert. Score how well this job matches this candidate's profile.

CANDIDATE PROFILE:
${this.cvText.substring(0, 1500)}

JOB:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description.substring(0, 800)}

Rate the match from 1-100 and give a brief reason. Respond ONLY in this exact JSON format:
{"score": <number>, "reason": "<one sentence>", "key_match": "<top matching skill>", "gap": "<main missing requirement or 'none'>"}`;

    try {
      const response = await this._callOllama(prompt);

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: Math.min(100, Math.max(0, parseInt(parsed.score) || 50)),
          reason: parsed.reason || 'No reason provided',
          keyMatch: parsed.key_match || 'General fit',
          gap: parsed.gap || 'none',
        };
      }
    } catch (e) {
      console.error(`[Ranker] Failed to score job: ${job.title} at ${job.company}`, e.message);
    }

    return { score: 50, reason: 'Could not evaluate', keyMatch: 'Unknown', gap: 'Unknown' };
  }

  /**
   * Rank all jobs and return top N
   */
  async rankJobs(jobs, topN = 3) {
    if (!this.cvText) {
      console.error('[Ranker] No CV text loaded, returning first jobs unranked');
      return jobs.slice(0, topN).map(j => ({ ...j, matchScore: 50, matchReason: 'Unranked (no CV)' }));
    }

    console.log(`[Ranker] Scoring ${jobs.length} jobs with Ollama...`);

    const scoredJobs = [];

    // Process in batches of 3 to avoid overloading Ollama
    for (let i = 0; i < jobs.length; i += 3) {
      const batch = jobs.slice(i, i + 3);
      const results = await Promise.allSettled(
        batch.map(job => this._scoreJob(job))
      );

      for (let j = 0; j < batch.length; j++) {
        const score = results[j].status === 'fulfilled'
          ? results[j].value
          : { score: 50, reason: 'Scoring failed', keyMatch: 'Unknown', gap: 'Unknown' };

        scoredJobs.push({
          ...batch[j],
          matchScore: score.score,
          matchReason: score.reason,
          keyMatch: score.keyMatch,
          gap: score.gap,
        });
      }

      // Small delay between batches
      if (i + 3 < jobs.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Sort by score descending
    scoredJobs.sort((a, b) => b.matchScore - a.matchScore);

    const topJobs = scoredJobs.slice(0, topN);
    console.log(`[Ranker] Top ${topN} jobs:`);
    topJobs.forEach((j, i) =>
      console.log(`  ${i + 1}. [${j.matchScore}%] ${j.title} @ ${j.company}`)
    );

    return topJobs;
  }
}

module.exports = JobRanker;
