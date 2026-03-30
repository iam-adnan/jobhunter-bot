const nodemailer = require('nodemailer');
const fs = require('fs');
const config = require('./config');

class EmailSender {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  }

  /**
   * Send application email with tailored CV attached
   */
  async sendApplication({ to, subject, body, cvPath, cvFilename }) {
    const mailOptions = {
      from: `"${config.email.fromName}" <${config.email.user}>`,
      to,
      subject,
      text: body,
      html: this._formatHtml(body),
      attachments: [{
        filename: cvFilename,
        path: cvPath,
      }],
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[Email] Sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[Email] Failed to send to ${to}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Convert plain text email to simple HTML
   */
  _formatHtml(text) {
    const paragraphs = text.split('\n\n').map(p => {
      const lines = p.split('\n').join('<br>');
      return `<p style="font-family: Calibri, Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6; margin-bottom: 12px;">${lines}</p>`;
    });

    return `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        ${paragraphs.join('')}
      </div>
    `;
  }

  /**
   * Verify SMTP connection works
   */
  async verify() {
    try {
      await this.transporter.verify();
      console.log('[Email] SMTP connection verified');
      return true;
    } catch (err) {
      console.error('[Email] SMTP verification failed:', err.message);
      return false;
    }
  }
}

module.exports = EmailSender;
