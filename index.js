const { Client, GatewayIntentBits, Partials } = require('discord.js');
const cron = require('node-cron');
const config = require('./config');
const JobScraper = require('./jobScraper');
const JobRanker = require('./jobRanker');
const CVTailor = require('./cvTailor');
const EmailSender = require('./emailSender');
const DiscordHandler = require('./discordHandler');
const LinkedInNetworker = require('./linkedinNetworker');
const LinkedInBrowserBot = require('./linkedinBrowserBot');

// ─── Initialize Discord Client ──────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
  ],
});

// ─── Initialize Modules ─────────────────────────────────────────────
const scraper = new JobScraper();
const ranker = new JobRanker();
const cvTailor = new CVTailor();
const emailSender = new EmailSender();
const networker = new LinkedInNetworker();
const browserBot = new LinkedInBrowserBot();
let discordHandler;

let isPaused = false;
let lastScanStats = { found: 0, emailsSent: 0 };

// ─── Daily Job Scan ──────────────────────────────────────────────────
async function runDailyScan() {
  if (isPaused) {
    console.log('[Bot] Daily scan skipped (paused)');
    return;
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  🔍 Starting Daily Job Scan');
  console.log('═══════════════════════════════════════\n');

  try {
    // Step 1: Scrape jobs from all sources
    const jobs = await scraper.fetchAllJobs();

    if (jobs.length === 0) {
      console.log('[Bot] No new jobs found today');
      const channel = await client.channels.fetch(config.discord.channelId);
      if (channel) {
        await channel.send('😴 No new matching jobs found today. I\'ll check again tomorrow!');
      }
      return;
    }

    // Step 2: Rank jobs using local AI (Ollama)
    const topJobs = await ranker.rankJobs(jobs, 3);

    // Step 3: Post to Discord
    await discordHandler.postJobs(topJobs);

    // Step 4: Run LinkedIn networking cycle
    try {
      console.log('[Bot] Starting LinkedIn networking cycle...');
      const networkResult = await networker.runNetworkingCycle(topJobs);

      // Step 5: Execute browser automation (if puppeteer is available)
      let browserResult = { peopleConnected: [], companiesFollowed: [] };
      try {
        browserResult = await browserBot.execute(networkResult.automationScript);
        networker.recordCompletedConnections(
          browserResult.peopleConnected,
          browserResult.companiesFollowed
        );
      } catch (browserErr) {
        console.log('[Bot] Browser automation not available:', browserErr.message);
        console.log('[Bot] Networking targets saved to data/today_networking.json');
        console.log('[Bot] You can run these manually or via Claude in Chrome.');
      }

      // Step 6: Report networking results to Discord
      await discordHandler.sendNetworkingReport({
        peopleConnected: browserResult.peopleConnected.length,
        companiesFollowed: browserResult.companiesFollowed.length,
        targets: networkResult.targets,
        errors: browserResult.errors || [],
        skipped: browserResult.skipped || [],
      });

    } catch (netErr) {
      console.error('[Bot] Networking cycle error:', netErr.message);
    }

    lastScanStats = { found: jobs.length, emailsSent: 0 };
    console.log('[Bot] Daily scan complete!\n');

  } catch (err) {
    console.error('[Bot] Daily scan error:', err);
    try {
      const channel = await client.channels.fetch(config.discord.channelId);
      if (channel) {
        await channel.send(`❌ Daily scan encountered an error: ${err.message}`);
      }
    } catch (e) { /* ignore */ }
  }
}

// ─── Discord Event Handlers ──────────────────────────────────────────
client.once('ready', async () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   🤖 JobHunter Bot is ONLINE!        ║');
  console.log(`║   Logged in as: ${client.user.tag.padEnd(18)}  ║`);
  console.log('╚══════════════════════════════════════╝\n');

  discordHandler = new DiscordHandler(client, cvTailor, emailSender);

  // Verify email connection
  await emailSender.verify();

  // Schedule daily scan
  const [hour, minute] = config.schedule.dailyScanTime.split(':');
  const cronExpression = `${minute} ${hour} * * *`;

  cron.schedule(cronExpression, runDailyScan, {
    timezone: config.schedule.timezone,
  });

  console.log(`[Bot] Daily scan scheduled at ${config.schedule.dailyScanTime} ${config.schedule.timezone}`);
  console.log(`[Bot] Watching for job titles: ${config.jobs.titles.join(', ')}`);
  console.log(`[Bot] Locations: ${config.jobs.locations.join(', ')}`);

  // Send startup message
  try {
    const channel = await client.channels.fetch(config.discord.channelId);
    if (channel) {
      await channel.send(
        '🟢 **JobHunter Bot is online!**\n' +
        `📋 Tracking: ${config.jobs.titles.join(', ')}\n` +
        `📍 Locations: ${config.jobs.locations.join(', ')}\n` +
        `⏰ Daily scan at: ${config.schedule.dailyScanTime}\n` +
        `Type \`!help\` for commands.`
      );
    }
  } catch (e) {
    console.error('[Bot] Could not send startup message:', e.message);
  }
});

// ─── Reaction Handler ────────────────────────────────────────────────
client.on('messageReactionAdd', async (reaction, user) => {
  // Fetch partial reactions
  if (reaction.partial) {
    try { await reaction.fetch(); } catch (e) { return; }
  }
  if (reaction.message.partial) {
    try { await reaction.message.fetch(); } catch (e) { return; }
  }

  if (discordHandler) {
    await discordHandler.handleReaction(reaction, user);
  }
});

// ─── Command Handler ─────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.author.id !== config.discord.userId) return;
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  switch (command) {
    case 'help':
      await message.reply(
        '**📖 JobHunter Bot Commands:**\n' +
        '`!status` — Check bot health and stats\n' +
        '`!scan` — Run a job scan now\n' +
        '`!search <query>` — Search for specific jobs\n' +
        '`!history` — View application history\n' +
        '`!network` — Run LinkedIn networking now\n' +
        '`!netstats` — View networking stats\n' +
        '`!pause` — Pause daily alerts\n' +
        '`!resume` — Resume daily alerts\n' +
        '`!titles <title1, title2>` — Update job titles\n' +
        '`!locations <loc1, loc2>` — Update locations'
      );
      break;

    case 'status':
      await discordHandler.sendStatus(lastScanStats);
      break;

    case 'scan':
      await message.reply('🔍 Starting manual job scan...');
      await runDailyScan();
      break;

    case 'search':
      const query = args.join(' ');
      if (!query) {
        await message.reply('Usage: `!search <job title or keywords>`');
        break;
      }
      await message.reply(`🔍 Searching for: **${query}**...`);

      // Temporarily override titles for this search
      const originalTitles = config.jobs.titles;
      config.jobs.titles = [query];
      try {
        const jobs = await scraper.fetchAllJobs();
        const ranked = await ranker.rankJobs(jobs, 3);
        if (ranked.length > 0) {
          await discordHandler.postJobs(ranked);
        } else {
          await message.reply('No matching jobs found for that search.');
        }
      } finally {
        config.jobs.titles = originalTitles;
      }
      break;

    case 'history':
      const applied = discordHandler.appliedJobs;
      if (applied.length === 0) {
        await message.reply('No applications yet!');
      } else {
        const recent = applied.slice(-10).reverse();
        const list = recent.map((j, i) =>
          `${i + 1}. **${j.title}** @ ${j.company} — ${new Date(j.appliedAt).toLocaleDateString()} ${j.emailSent ? '📧' : '📋'}`
        ).join('\n');
        await message.reply(`**📜 Recent Applications (${applied.length} total):**\n${list}`);
      }
      break;

    case 'pause':
      isPaused = true;
      await message.reply('⏸️ Daily alerts paused. Type `!resume` to restart.');
      break;

    case 'resume':
      isPaused = false;
      await message.reply('▶️ Daily alerts resumed!');
      break;

    case 'titles':
      const newTitles = args.join(' ').split(',').map(s => s.trim()).filter(Boolean);
      if (newTitles.length === 0) {
        await message.reply(`Current titles: ${config.jobs.titles.join(', ')}\nUsage: \`!titles Frontend Dev, React Dev\``);
      } else {
        config.jobs.titles = newTitles;
        await message.reply(`✅ Updated job titles: ${newTitles.join(', ')}`);
      }
      break;

    case 'locations':
      const newLocs = args.join(' ').split(',').map(s => s.trim()).filter(Boolean);
      if (newLocs.length === 0) {
        await message.reply(`Current locations: ${config.jobs.locations.join(', ')}\nUsage: \`!locations Remote, London\``);
      } else {
        config.jobs.locations = newLocs;
        await message.reply(`✅ Updated locations: ${newLocs.join(', ')}`);
      }
      break;

    case 'network':
      await message.reply('🔗 Running manual networking cycle...');
      try {
        const topJobsCache = JSON.parse(require('fs').readFileSync(config.paths.jobCache, 'utf-8')).slice(0, 3);
        const netResult = await networker.runNetworkingCycle(topJobsCache);
        let browserRes = { peopleConnected: [], companiesFollowed: [] };
        try {
          browserRes = await browserBot.execute(netResult.automationScript);
          networker.recordCompletedConnections(browserRes.peopleConnected, browserRes.companiesFollowed);
        } catch (e) {
          await message.reply(`⚠️ Browser automation unavailable. Targets saved to \`data/today_networking.json\`.\nInstall puppeteer: \`npm install puppeteer-core\``);
        }
        await discordHandler.sendNetworkingReport({
          peopleConnected: browserRes.peopleConnected.length,
          companiesFollowed: browserRes.companiesFollowed.length,
          targets: netResult.targets,
          errors: browserRes.errors || [],
          skipped: browserRes.skipped || [],
        });
      } catch (e) {
        await message.reply(`❌ Networking error: ${e.message}`);
      }
      break;

    case 'netstats':
      const summary = networker.getWeeklySummary();
      await message.reply(
        `**📊 Networking Stats:**\n` +
        `👥 People this week: ${summary.peopleThisWeek}\n` +
        `🏢 Companies this week: ${summary.companiesThisWeek}\n` +
        `👥 Total people all-time: ${summary.totalPeopleAllTime}\n` +
        `🏢 Total companies all-time: ${summary.totalCompaniesAllTime}\n` +
        `🏷️ Top industries: ${summary.topIndustries.join(', ') || 'N/A'}`
      );
      break;

    default:
      await message.reply(`Unknown command: \`!${command}\`. Type \`!help\` for available commands.`);
  }
});

// ─── Error Handling ──────────────────────────────────────────────────
client.on('error', err => console.error('[Discord] Client error:', err));
process.on('unhandledRejection', err => console.error('[Bot] Unhandled rejection:', err));
process.on('uncaughtException', err => {
  console.error('[Bot] Uncaught exception:', err);
  process.exit(1);
});

// ─── Start ───────────────────────────────────────────────────────────
console.log('[Bot] Starting JobHunter Bot...');
client.login(config.discord.token);
