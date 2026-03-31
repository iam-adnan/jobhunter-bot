# 🎯 JobHunter Bot

An AI-powered Discord bot that automates your entire job hunting pipeline — finding jobs, tailoring your CV, sending applications, and networking on LinkedIn. Runs locally on your Mac with zero ongoing costs beyond your existing Claude subscription.

Everything is controlled from Discord. Upload your CV, change job preferences, trigger scans, apply to jobs — all without touching the terminal.

![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-Llama_3.1-black?logo=meta&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-Sonnet-D4A574?logo=anthropic&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## How It Works

Every day at your scheduled time, the bot:

1. **Scrapes jobs** from 4 platforms (RemoteOK, Arbeitnow, Indeed/LinkedIn/Glassdoor via JSearch, Adzuna)
2. **Ranks them** against your CV using a local Ollama model (Llama 3.1 8B) — completely free
3. **Posts the top 3** to your private Discord channel with match scores
4. **Waits for your 👍 reaction** on any job you like
5. **Tailors your CV** using Claude Sonnet — rewrites summary, reorders skills, adds keywords
6. **Writes a personalized cover email** referencing your actual experience
7. **Sends the email** with the tailored CV attached via Gmail
8. **Confirms** back in Discord with ✅
9. **Networks on LinkedIn** — visits profiles and connects with relevant people in your industry

---

## Job Sources

The bot aggregates jobs from 4 free platforms simultaneously:

| Source | What it covers | API Key Required | Free Tier |
|--------|---------------|-----------------|-----------|
| **RemoteOK** | Remote-only tech jobs worldwide | No key needed | Unlimited |
| **Arbeitnow** | EU-focused jobs with remote filter | No key needed | Unlimited |
| **JSearch (RapidAPI)** | Aggregates **LinkedIn, Indeed, Glassdoor, ZipRecruiter** and 20+ other job boards | Free key from [RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) | 500 requests/month |
| **Adzuna** | UK, EU, US, Australia, India job boards | Free key from [Adzuna](https://developer.adzuna.com/) | 250 requests/month |

**RemoteOK** and **Arbeitnow** work out of the box with zero setup. For maximum coverage (especially LinkedIn and Indeed jobs), sign up for the free JSearch API key — it takes 2 minutes.

Your scan results will show the source for each job:

```
[Scraper] Found 22 unique jobs from 2 sources
[Scraper] Source breakdown: { RemoteOK: 2, Indeed: 20 }
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     YOUR MAC MINI                        │
│                                                          │
│  ┌──────────────────┐    ┌─────────────────────────────┐ │
│  │  Ollama           │    │  Discord Bot (Node.js)      │ │
│  │  Llama 3.1 8B     │◄──►│                             │ │
│  │  (FREE, local)    │    │  • Scrapes 4 job platforms  │ │
│  └──────────────────┘    │  • Sends top 3 to Discord   │ │
│                          │  • 👍 → tailors CV + emails  │ │
│  ┌──────────────────┐    │  • Networks on LinkedIn     │ │
│  │  Claude Sonnet    │◄──►│  • Full control via Discord │ │
│  │  ($20 sub API)    │    └─────────────────────────────┘ │
│  └──────────────────┘                                     │
│                                                          │
│  ┌──────────────────┐    ┌─────────────────────────────┐ │
│  │  Job APIs         │    │  LinkedIn (Puppeteer)       │ │
│  │  RemoteOK,JSearch │    │  Profile-by-profile         │ │
│  │  Arbeitnow,Adzuna │    │  Connect + Follow           │ │
│  └──────────────────┘    └─────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## Cost Breakdown

| Component | Cost |
|-----------|------|
| Ollama (Llama 3.1 8B) | **Free** — runs locally |
| Discord Bot | **Free** |
| RemoteOK API | **Free** — no key needed |
| Arbeitnow API | **Free** — no key needed |
| JSearch API (RapidAPI) | **Free** — 500 requests/month |
| Adzuna API | **Free** — 250 requests/month |
| Gmail SMTP | **Free** — 500 emails/day |
| Claude Sonnet API | **~$0.01/application** (from your $20 Pro sub) |
| LinkedIn networking | **Free** — uses your browser |
| **Total extra cost** | **$0** |

---

## Prerequisites

- **macOS** (tested on Mac Mini M2 and Intel i7)
- **Node.js 20+** — `brew install node`
- **Ollama** — `brew install ollama`
- **Discord account** with a server you own
- **Claude Pro subscription** ($20/month) for API access
- **Gmail account** with 2-Step Verification enabled
- **Google Chrome** (for LinkedIn networking)

---

## Project Structure

```
jobhunter-bot/
├── index.js                 # Main entry — Discord client, scheduler, all commands
├── config.js                # Environment config loader
├── jobScraper.js            # Scrapes RemoteOK, Arbeitnow, JSearch, Adzuna
├── jobRanker.js             # Ranks jobs with Ollama (local, free)
├── cvTailor.js              # Claude Sonnet: tailors CV + writes cover emails
├── emailSender.js           # Gmail SMTP sender
├── discordHandler.js        # Discord embeds, reactions, reports
├── linkedinNetworker.js     # Ollama generates networking targets
├── linkedinBrowserBot.js    # Puppeteer: visits profiles, connects/follows
├── package.json
├── setup.sh                 # One-click setup script
├── .env                     # Your secrets (git-ignored)
└── data/
    ├── master_cv.pdf        # Your CV (sent to recruiters)
    ├── master_cv.txt        # Your CV as text (read by AI)
    ├── applied_jobs.json    # Application history
    ├── job_cache.json       # Cached job listings
    ├── connections_log.json # LinkedIn networking history
    ├── today_networking.json
    ├── screenshots/         # Debug screenshots from LinkedIn
    └── bot-chrome-profile/  # Chrome session for LinkedIn
```

---

## Installation

### Quick Setup

```bash
git clone https://github.com/YOUR_USERNAME/jobhunter-bot.git
cd jobhunter-bot
chmod +x setup.sh
./setup.sh
```

### Manual Setup

```bash
git clone https://github.com/YOUR_USERNAME/jobhunter-bot.git
cd jobhunter-bot

# Install Ollama and pull model
brew install ollama
ollama serve &
ollama pull llama3.1:8b

# Install dependencies
npm install

# Optional: LinkedIn automation
npm install puppeteer-core

# Create directories
mkdir -p data logs data/screenshots
```

---

## Configuration

### Step 1: Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → name it **JobHunter Bot**
3. Go to **Bot** tab → **Add Bot**
4. Enable **Privileged Gateway Intents**: Message Content, Server Members, Presence
5. Copy the **bot token**
6. Go to **OAuth2 → URL Generator** → Scopes: `bot` → Permissions: Send Messages, Read History, Add Reactions, Embed Links, Attach Files
7. Open the generated URL → add bot to your server
8. Create a `#job-alerts` channel
9. Right-click channel → **Copy Channel ID** (enable Developer Mode in Settings → Advanced)
10. Right-click your name → **Copy User ID**

### Step 2: Get Claude API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. **Settings → API Keys → Create Key**

Your $20 Pro sub includes $5/month API credits. Each application costs ~$0.01.

### Step 3: Gmail App Password

1. Enable [2-Step Verification](https://myaccount.google.com/security)
2. Create [App Password](https://myaccount.google.com/apppasswords) for Mail → Mac
3. Copy the 16-character password

### Step 4: Find Your Chrome Profile

```bash
for dir in ~/Library/Application\ Support/Google/Chrome/Profile\ * ~/Library/Application\ Support/Google/Chrome/Default; do
  name=$(grep -o '"name":"[^"]*"' "$dir/Preferences" 2>/dev/null | head -1)
  echo "$(basename "$dir") → $name"
done
```

Note which profile has your LinkedIn login (e.g., `Profile 1` or `Profile 2`).

### Step 5: Configure `.env`

```bash
cp .env.example .env
nano .env
```

```env
# ─── REQUIRED ─────────────────────────────────────────
DISCORD_TOKEN=your_bot_token
DISCORD_CHANNEL_ID=your_channel_id
DISCORD_USER_ID=your_user_id
ANTHROPIC_API_KEY=sk-ant-api03-...
EMAIL_USER=you@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
EMAIL_FROM_NAME=Your Full Name

# ─── JOB PREFERENCES (changeable from Discord too) ───
JOB_TITLES=Software Engineer,Full Stack Developer
JOB_LOCATIONS=Remote,Lahore,Pakistan
JOB_EXPERIENCE_LEVEL=mid,senior
EXCLUDED_COMPANIES=
MIN_SALARY=0

# ─── SCHEDULE ─────────────────────────────────────────
DAILY_SCAN_TIME=09:00
TIMEZONE=Asia/Karachi

# ─── OLLAMA ───────────────────────────────────────────
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# ─── FILES ────────────────────────────────────────────
MASTER_CV_PATH=./data/master_cv.pdf
MASTER_CV_TEXT_PATH=./data/master_cv.txt

# ─── CHROME (for LinkedIn) ────────────────────────────
CHROME_PROFILE=Profile 2

# ─── OPTIONAL: Extra Job Sources ─────────────────────
RAPIDAPI_KEY=
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
```

### Step 6: Add Your CV

Place your CV in the `data/` folder OR upload it via Discord later with `!cv`:

```bash
cp ~/your-cv.pdf data/master_cv.pdf
nano data/master_cv.txt   # Paste CV as plain text
```

---

## Running

```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start the bot
cd ~/jobhunter-bot
npm start
```

You'll see:

```
╔══════════════════════════════════════╗
║   🤖 JobHunter Bot is ONLINE!        ║
║   Logged in as: JobHunter#6717       ║
╚══════════════════════════════════════╝
```

### Auto-Start on Boot

```bash
cat > ~/Library/LaunchAgents/com.jobhunter.bot.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.jobhunter.bot</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/node</string>
        <string>index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/YOUR_USERNAME/jobhunter-bot</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/Users/YOUR_USERNAME/jobhunter-bot/logs/bot.log</string>
    <key>StandardErrorPath</key><string>/Users/YOUR_USERNAME/jobhunter-bot/logs/bot-error.log</string>
</dict>
</plist>
EOF

sed -i '' "s/YOUR_USERNAME/$(whoami)/g" ~/Library/LaunchAgents/com.jobhunter.bot.plist
launchctl load ~/Library/LaunchAgents/com.jobhunter.bot.plist
```

---

## Discord Commands — Full Reference

### 🔍 Job Search

| Command | Description | Example |
|---------|-------------|---------|
| `!scan` | Run a job scan immediately | `!scan` |
| `!search <query>` | Search for specific jobs | `!search React developer London` |
| `!titles <t1, t2>` | Update target job titles | `!titles DevOps Engineer, SRE` |
| `!locations <l1, l2>` | Update target locations | `!locations Remote, Berlin, Dubai` |
| `!experience <levels>` | Set experience level | `!experience junior, mid` |
| `!salary <amount>` | Set minimum salary (USD) | `!salary 60000` |
| `!exclude <companies>` | Blacklist companies | `!exclude Google, Meta` |
| `!exclude clear` | Clear the blacklist | `!exclude clear` |

### 📄 CV & Applications

| Command | Description | Example |
|---------|-------------|---------|
| `!cv` | View CV status and preview | `!cv` |
| `!cv` + attach file | Upload new CV (.pdf, .txt, .docx) | Drag file + type `!cv` |
| `!apply <url>` | Tailor CV for a job URL | `!apply https://company.com/job` |
| `!apply <url> <email>` | Tailor CV + send email to recruiter | `!apply https://company.com/job hr@company.com` |
| `!history` | View last 10 applications | `!history` |

### 🔗 LinkedIn Networking

| Command | Description | Example |
|---------|-------------|---------|
| `!network` | Run networking cycle now | `!network` |
| `!netstats` | View networking statistics | `!netstats` |

### ⚙️ Settings & Control

| Command | Description | Example |
|---------|-------------|---------|
| `!config` | View ALL current settings | `!config` |
| `!schedule <HH:MM>` | Change daily scan time | `!schedule 10:30` |
| `!email` | View email settings | `!email` |
| `!email test` | Send test email to yourself | `!email test` |
| `!email name <name>` | Change email sender name | `!email name Muhammad Adnan` |
| `!pause` | Pause daily alerts | `!pause` |
| `!resume` | Resume daily alerts | `!resume` |
| `!status` | Check bot health | `!status` |
| `!help` | Show all commands | `!help` |

### Reaction Controls

| Reaction | Action |
|----------|--------|
| 👍 | Apply — tailors CV, writes email, sends application |
| 👎 | Skip this job |
| ❓ | Show full job details |

---

## Daily Flow

```
9:00 AM ─► Scrape from RemoteOK + Arbeitnow + JSearch + Adzuna
              │
              ▼
         Ollama ranks all jobs against your CV (free)
              │
              ├──► Top 3 posted to Discord with match scores
              │         │
              │    You react 👍
              │         │
              │    Claude tailors your CV (~$0.01)
              │         │
              │    Email sent with tailored CV attached
              │         │
              │    Discord confirms ✅
              │
              └──► LinkedIn networking
                        │
                   Ollama picks targets
                        │
                   Bot visits each profile
                        │
                   Connects/Follows with verification
                        │
                   Reports to Discord
```

---

## LinkedIn Networking

### How It Works

1. Ollama analyzes your CV + today's jobs → generates target role types and companies
2. Bot searches LinkedIn for those roles
3. **Collects individual profile URLs** from search results
4. **Visits each profile page** one by one
5. Clicks **Connect** (with personalized note) or **Follow** on each profile
6. **Verifies** each action (checks for "Pending" or "Following")
7. Reports results to Discord

### Safety

| Feature | Detail |
|---------|--------|
| Daily limits | Max 50 connections + 10 company follows |
| Human-like delays | 8–25 second random wait between actions |
| Rate limit detection | Stops immediately on LinkedIn warnings |
| Verification | Confirms each action actually worked |
| Profile-first approach | Visits individual profiles (more reliable than search page buttons) |

### Important

- Start with 20 connections/day for the first week
- LinkedIn can restrict accounts that automate aggressively
- First run closes Chrome and relaunches with your profile
- Bot copies your LinkedIn cookies into a separate profile for automation

---

## Verifying Everything Works

Run each test to confirm all components are functioning:

### Test 1: Config

```bash
node -e "
const config = require('./config');
console.log('Discord token:', config.discord.token ? '✅' : '❌');
console.log('Channel ID:', config.discord.channelId ? '✅' : '❌');
console.log('Claude API:', config.claude.apiKey ? '✅' : '❌');
console.log('Email:', config.email.user || '❌');
console.log('Titles:', config.jobs.titles.join(', '));
"
```

### Test 2: Ollama

```bash
node -e "
const axios = require('axios');
axios.post('http://localhost:11434/api/generate', {
  model: 'llama3.1:8b', prompt: 'Say hello', stream: false
}).then(r => console.log('✅ Ollama:', r.data.response))
  .catch(e => console.log('❌', e.message));
"
```

### Test 3: Job Scraping

```bash
node -e "
const S = require('./jobScraper'); const s = new S();
s.fetchAllJobs().then(j => {
  console.log('✅ Found', j.length, 'jobs');
  if (j[0]) console.log('  First:', j[0].title, '@', j[0].company, '(' + j[0].source + ')');
}).catch(e => console.log('❌', e.message));
"
```

### Test 4: Gmail

```bash
node -e "
const E = require('./emailSender'); const e = new E();
e.verify().then(ok => console.log(ok ? '✅ Gmail connected' : '❌ Gmail failed'));
"
```

### Test 5: Claude API

```bash
node -e "
const Anthropic = require('@anthropic-ai/sdk').default;
const config = require('./config');
const c = new Anthropic({ apiKey: config.claude.apiKey });
c.messages.create({ model: config.claude.model, max_tokens: 50,
  messages: [{ role: 'user', content: 'Say hello' }]
}).then(r => console.log('✅ Claude:', r.content[0].text))
  .catch(e => console.log('❌', e.message));
"
```

### Test 6: Discord Bot

```bash
node -e "
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const c = new Client({ intents: [GatewayIntentBits.Guilds] });
c.once('ready', () => { console.log('✅ Discord:', c.user.tag); c.destroy(); });
c.login(config.discord.token).catch(e => console.log('❌', e.message));
"
```

### Test 7: LinkedIn Networking Targets

```bash
node -e "
const N = require('./linkedinNetworker'); const n = new N();
n.generateSearchTargets([
  { title: 'Backend Dev', company: 'Stripe', location: 'Remote', description: 'Node.js' }
]).then(t => {
  console.log('✅ People targets:', t.people_searches?.length);
  console.log('✅ Company targets:', t.company_searches?.length);
}).catch(e => console.log('❌', e.message));
"
```

### Test 8: CV Tailoring + Email (sends to yourself)

```bash
node -e "
const CVTailor = require('./cvTailor');
const EmailSender = require('./emailSender');
(async () => {
  const tailor = new CVTailor();
  const emailer = new EmailSender();
  const job = {
    title: 'Support Engineer', company: 'TestCo', location: 'Remote',
    description: 'Customer support, APIs, troubleshooting, documentation'
  };
  console.log('Tailoring CV...');
  const result = await tailor.tailorForJob(job);
  console.log('✅ CV saved:', result.cvFilename);
  console.log('✅ Email preview:', result.coverEmail.substring(0, 150) + '...');
  const sent = await emailer.sendApplication({
    to: process.env.EMAIL_USER, subject: 'TEST Application',
    body: result.coverEmail, cvPath: result.cvPath, cvFilename: result.cvFilename
  });
  console.log(sent.success ? '✅ Email sent to yourself!' : '❌ Email failed: ' + sent.error);
})();
"
```

### Test 9: Full LinkedIn Verification

After running `!network`, check your sent invitations:

```
https://www.linkedin.com/mynetwork/invitation-manager/sent/
```

---

## Troubleshooting

### "Cannot read properties of undefined (reading 'Guilds')"

Wrong discord.js version:

```bash
rm -rf node_modules package-lock.json
npm install discord.js@14 --save && npm install
```

### "Ollama error: timeout"

Ollama is slow on CPU. The bot processes jobs one at a time with 180s timeout. If still timing out:

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not, start it
ollama serve &
```

### "Gmail SMTP failed"

- Use an **App Password** (16 chars), not your Gmail password
- Enable 2-Step Verification first: https://myaccount.google.com/security
- Get App Password: https://myaccount.google.com/apppasswords

### "Claude API error: 401"

- Check `ANTHROPIC_API_KEY` in `.env`
- Verify credits at https://console.anthropic.com/

### "No jobs found"

- Broaden `JOB_TITLES` (e.g., `Developer` instead of `Senior React TypeScript Developer`)
- Add `Remote` to locations
- Sign up for free RapidAPI JSearch key for LinkedIn/Indeed/Glassdoor coverage

### "Chrome debugging port not responding"

Bot closes Chrome and relaunches automatically. If it fails:

```bash
# Kill Chrome manually
killall -9 "Google Chrome"

# Verify your Chrome profile name
for dir in ~/Library/Application\ Support/Google/Chrome/Profile\ *; do
  name=$(grep -o '"name":"[^"]*"' "$dir/Preferences" 2>/dev/null | head -1)
  echo "$(basename "$dir") → $name"
done

# Set the correct profile in .env
echo 'CHROME_PROFILE=Profile 2' >> .env
```

### "No Connect buttons found"

The bot uses a profile-first approach: it collects profile URLs from search, then visits each one individually. If it still fails, check `data/screenshots/` for debug images:

```bash
open data/screenshots/
```

---

## Module Reference

| Module | Role | AI Used |
|--------|------|---------|
| `jobScraper.js` | Fetches from RemoteOK, Arbeitnow, JSearch, Adzuna | None |
| `jobRanker.js` | Scores jobs 1-100 against your CV | Ollama (free) |
| `cvTailor.js` | Rewrites CV + generates cover email | Claude Sonnet (~$0.01) |
| `emailSender.js` | Sends via Gmail SMTP | None |
| `discordHandler.js` | Embeds, reactions, reports | None |
| `linkedinNetworker.js` | Generates networking targets | Ollama (free) |
| `linkedinBrowserBot.js` | Browser automation for LinkedIn | None (Puppeteer) |

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m 'Add feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## Disclaimer

- This bot automates job applications and LinkedIn networking. Use responsibly.
- LinkedIn automation carries risk of account restriction. Safety features are built in, but use at your own risk.
- Always review tailored CVs and emails — AI can occasionally misrepresent experience.
- The bot sends emails on your behalf. Verify content before enabling fully automated sending.

---

**Built with Claude, Ollama, Discord.js, and Puppeteer**
