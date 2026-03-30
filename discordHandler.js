const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const config = require('./config');

class DiscordHandler {
  constructor(client, cvTailor, emailSender) {
    this.client = client;
    this.cvTailor = cvTailor;
    this.emailSender = emailSender;
    this.pendingJobs = new Map(); // messageId -> job data
    this.appliedJobs = this._loadApplied();
  }

  _loadApplied() {
    try {
      if (fs.existsSync(config.paths.appliedJobs)) {
        return JSON.parse(fs.readFileSync(config.paths.appliedJobs, 'utf-8'));
      }
    } catch (e) { /* ignore */ }
    return [];
  }

  _saveApplied() {
    fs.writeFileSync(config.paths.appliedJobs, JSON.stringify(this.appliedJobs, null, 2));
  }

  /**
   * Post top jobs as rich embeds to Discord
   */
  async postJobs(jobs) {
    const channel = await this.client.channels.fetch(config.discord.channelId);
    if (!channel) {
      console.error('[Discord] Could not find channel:', config.discord.channelId);
      return;
    }

    // Header message
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: config.schedule.timezone,
    });

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🎯 Daily Job Matches')
          .setDescription(`**${today}**\nHere are your top ${jobs.length} job matches for today.\nReact with 👍 to apply automatically!`)
          .setColor(0x5865F2)
          .setTimestamp(),
      ],
    });

    // Post each job as a separate embed
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      const embed = new EmbedBuilder()
        .setTitle(`${i + 1}. ${job.title}`)
        .setURL(job.url)
        .setColor(this._scoreColor(job.matchScore))
        .addFields(
          { name: '🏢 Company', value: job.company, inline: true },
          { name: '📍 Location', value: job.location, inline: true },
          { name: '💰 Salary', value: job.salary || 'Not specified', inline: true },
          { name: '📊 Match Score', value: `${'█'.repeat(Math.floor(job.matchScore / 10))}${'░'.repeat(10 - Math.floor(job.matchScore / 10))} ${job.matchScore}%`, inline: false },
          { name: '✅ Top Match', value: job.keyMatch || 'General fit', inline: true },
          { name: '⚠️ Gap', value: job.gap || 'None', inline: true },
          { name: '📝 Why', value: (job.matchReason || 'Good match').substring(0, 200), inline: false },
          { name: '🔗 Source', value: job.source, inline: true },
        )
        .setFooter({ text: 'React 👍 to apply • 👎 to skip • ❓ for more info' })
        .setTimestamp();

      // Truncated description
      if (job.description) {
        const shortDesc = job.description.substring(0, 300) + (job.description.length > 300 ? '...' : '');
        embed.setDescription(shortDesc);
      }

      const msg = await channel.send({ embeds: [embed] });

      // Add reactions
      await msg.react('👍');
      await msg.react('👎');
      await msg.react('❓');

      // Store job data with message ID
      this.pendingJobs.set(msg.id, job);
    }

    console.log(`[Discord] Posted ${jobs.length} jobs to #job-alerts`);
  }

  /**
   * Handle reaction - triggered when user reacts with 👍
   */
  async handleReaction(reaction, user) {
    // Ignore bot reactions
    if (user.bot) return;

    // Only respond to reactions from the configured user
    if (user.id !== config.discord.userId) return;

    const job = this.pendingJobs.get(reaction.message.id);
    if (!job) return;

    const channel = reaction.message.channel;

    if (reaction.emoji.name === '👍') {
      await this._handleApply(job, channel, reaction.message);
    } else if (reaction.emoji.name === '❓') {
      await this._handleMoreInfo(job, channel);
    }
  }

  /**
   * Process application: tailor CV → send email → confirm
   */
  async _handleApply(job, channel, message) {
    // Check if recruiter email exists
    if (!job.recruiterEmail && !job.applyUrl) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚠️ No Direct Email Available')
            .setDescription(
              `No recruiter email found for **${job.title}** at **${job.company}**.\n\n` +
              `**Apply directly here:** ${job.url}\n\n` +
              `I'll still tailor your CV — you can download it and apply manually.`
            )
            .setColor(0xFFA500),
        ],
      });
    }

    // Status: Processing
    const statusMsg = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('⏳ Processing Application...')
          .setDescription(`Tailoring CV for **${job.title}** at **${job.company}**...`)
          .setColor(0xFFFF00),
      ],
    });

    try {
      // Step 1: Tailor CV and generate email
      const result = await this.cvTailor.tailorForJob(job);

      // Step 2: Try to send email if we have a recruiter address
      let emailResult = { success: false, error: 'No recruiter email' };

      if (job.recruiterEmail) {
        emailResult = await this.emailSender.sendApplication({
          to: job.recruiterEmail,
          subject: `Application: ${job.title} — ${result.cvData.name}`,
          body: result.coverEmail,
          cvPath: result.cvPath,
          cvFilename: result.cvFilename,
        });
      }

      // Step 3: Save to applied jobs
      this.appliedJobs.push({
        id: job.id,
        title: job.title,
        company: job.company,
        appliedAt: new Date().toISOString(),
        emailSent: emailResult.success,
        cvPath: result.cvPath,
      });
      this._saveApplied();

      // Step 4: Send confirmation
      const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ Application Processed!')
        .setColor(0x00FF00)
        .addFields(
          { name: '📋 Job', value: `${job.title} @ ${job.company}`, inline: false },
          { name: '📄 Tailored CV', value: result.cvFilename, inline: true },
          { name: '📧 Email Sent', value: emailResult.success ? '✅ Yes' : '❌ No (apply manually)', inline: true },
        );

      if (!emailResult.success) {
        confirmEmbed.addFields({
          name: '🔗 Apply Here',
          value: job.url || job.applyUrl || 'See original posting',
          inline: false,
        });
      }

      // Show the cover email
      confirmEmbed.addFields({
        name: '📝 Cover Email',
        value: result.coverEmail.substring(0, 1000) + (result.coverEmail.length > 1000 ? '...' : ''),
        inline: false,
      });

      await statusMsg.edit({ embeds: [confirmEmbed] });

      // Attach the CV file
      await channel.send({
        content: `📎 Here's your tailored CV:`,
        files: [result.cvPath],
      });

    } catch (err) {
      console.error('[Discord] Application processing error:', err);
      await statusMsg.edit({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Error Processing Application')
            .setDescription(`Something went wrong: ${err.message}\n\nYou can still apply manually: ${job.url}`)
            .setColor(0xFF0000),
        ],
      });
    }
  }

  /**
   * Show more details about a job
   */
  async _handleMoreInfo(job, channel) {
    const embed = new EmbedBuilder()
      .setTitle(`📋 ${job.title} — Full Details`)
      .setURL(job.url)
      .setColor(0x5865F2)
      .setDescription(job.description.substring(0, 4000))
      .addFields(
        { name: '🏢 Company', value: job.company, inline: true },
        { name: '📍 Location', value: job.location, inline: true },
        { name: '💰 Salary', value: job.salary, inline: true },
        { name: '🏷️ Tags', value: (job.tags || []).join(', ') || 'None', inline: false },
        { name: '🔗 Apply', value: job.applyUrl || job.url, inline: false },
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }

  /**
   * Get color based on match score
   */
  _scoreColor(score) {
    if (score >= 80) return 0x00FF00; // Green
    if (score >= 60) return 0xFFFF00; // Yellow
    if (score >= 40) return 0xFFA500; // Orange
    return 0xFF0000; // Red
  }

  /**
   * Send networking results report to Discord
   */
  async sendNetworkingReport(data) {
    const channel = await this.client.channels.fetch(config.discord.channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('🔗 Daily LinkedIn Networking Report')
      .setColor(0x0A66C2) // LinkedIn blue
      .setTimestamp();

    if (data.peopleConnected > 0 || data.companiesFollowed > 0) {
      embed.setDescription(
        `✅ **Networking complete for today!**`
      );
      embed.addFields(
        { name: '👥 People Connected', value: `${data.peopleConnected}`, inline: true },
        { name: '🏢 Companies Followed', value: `${data.companiesFollowed}`, inline: true },
      );
    } else {
      embed.setDescription(
        `📋 **Networking targets generated!**\n` +
        `Browser automation didn't run (install \`puppeteer-core\` to enable).\n` +
        `Targets saved to \`data/today_networking.json\` — you can:\n` +
        `• Run manually via Claude in Chrome\n` +
        `• Or use the saved search URLs to connect yourself`
      );
    }

    // Show who we're targeting
    if (data.targets && data.targets.people_searches) {
      const targetSummary = data.targets.people_searches.slice(0, 5).map(t =>
        `• **${t.role_type}** ${t.company !== 'any' ? `@ ${t.company}` : ''}`
      ).join('\n');
      embed.addFields({
        name: '🎯 Today\'s Targets',
        value: targetSummary || 'N/A',
        inline: false,
      });
    }

    if (data.targets && data.targets.company_searches) {
      const compSummary = data.targets.company_searches.map(c =>
        `• ${c.company_name} (${c.industry})`
      ).join('\n');
      embed.addFields({
        name: '🏢 Companies to Follow',
        value: compSummary || 'N/A',
        inline: false,
      });
    }

    if (data.targets && data.targets.industry_keywords) {
      embed.addFields({
        name: '🏷️ Industry Keywords',
        value: data.targets.industry_keywords.join(', '),
        inline: false,
      });
    }

    if (data.errors && data.errors.length > 0) {
      embed.addFields({
        name: '⚠️ Issues',
        value: data.errors.slice(0, 3).map(e => `${e.step}: ${e.error}`).join('\n'),
        inline: false,
      });
    }

    if (data.skipped && data.skipped.length > 0) {
      embed.addFields({
        name: '⏭️ Skipped',
        value: `${data.skipped.length} targets skipped (no connect button found)`,
        inline: false,
      });
    }

    await channel.send({ embeds: [embed] });
  }

  /**
   * Send a status message
   */
  async sendStatus(stats) {
    const channel = await this.client.channels.fetch(config.discord.channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('📊 Bot Status')
      .setColor(0x5865F2)
      .addFields(
        { name: '🤖 Status', value: 'Online', inline: true },
        { name: '📋 Total Applied', value: `${this.appliedJobs.length}`, inline: true },
        { name: '⏰ Next Scan', value: config.schedule.dailyScanTime, inline: true },
        { name: '🎯 Job Titles', value: config.jobs.titles.join(', '), inline: false },
        { name: '📍 Locations', value: config.jobs.locations.join(', '), inline: false },
      )
      .setTimestamp();

    if (stats) {
      embed.addFields(
        { name: '🔍 Jobs Found Today', value: `${stats.found || 0}`, inline: true },
        { name: '📤 Emails Sent Today', value: `${stats.emailsSent || 0}`, inline: true },
      );
    }

    await channel.send({ embeds: [embed] });
  }
}

module.exports = DiscordHandler;
