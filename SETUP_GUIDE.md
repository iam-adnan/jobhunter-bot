# 🎯 JobHunter Bot — Complete Setup Guide (Mac Mini M2)

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  YOUR MAC MINI M2                │
│                                                  │
│  ┌──────────────┐    ┌────────────────────────┐  │
│  │  OpenCLAW    │    │    Discord Bot          │  │
│  │  (Ollama +   │◄──►│  (Node.js)             │  │
│  │   Llama 3.1) │    │                         │  │
│  └──────────────┘    │  • Scrapes jobs daily   │  │
│                      │  • Sends top 3 to you   │  │
│  ┌──────────────┐    │  • On 👍 reaction:      │  │
│  │  Claude API  │◄──►│    - Tailors CV         │  │
│  │  (Sonnet)    │    │    - Sends email         │  │
│  │  via $20 sub │    │    - Confirms in Discord │  │
│  └──────────────┘    └────────────────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  Job Sources (Free APIs / Scraping)       │    │
│  │  • LinkedIn (via RapidAPI free tier)       │    │
│  │  • RemoteOK API (free)                    │    │
│  │  • Arbeitnow API (free)                   │    │
│  │  • Indeed scraping (via SerpAPI free)      │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

## Cost Breakdown
- **Claude $20/month subscription** — used via API (Sonnet model) for CV tailoring + emails
- **Ollama (Llama 3.1 8B)** — FREE, runs locally for job ranking/filtering
- **Discord Bot** — FREE
- **Job APIs** — FREE tiers
- **Gmail SMTP** — FREE (up to 500 emails/day)
- **Total extra cost: $0**

---

## STEP 1: Install Prerequisites

Open Terminal on your Mac Mini and run these commands:

```bash
# 1. Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Add Homebrew to PATH (Apple Silicon)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# 3. Install Node.js 20+ and Python 3
brew install node python3

# 4. Install Ollama (local AI - FREE)
brew install ollama

# 5. Start Ollama and pull the model
ollama serve &
sleep 5
ollama pull llama3.1:8b

# 6. Verify installations
node --version    # Should show v20+
python3 --version # Should show 3.11+
ollama --version  # Should show installed version
```

---

## STEP 2: Create the Project

```bash
# Create project directory
mkdir -p ~/jobhunter-bot
cd ~/jobhunter-bot

# Initialize Node.js project
npm init -y

# Install dependencies
npm install discord.js node-cron axios cheerio nodemailer dotenv docx anthropic pdf-lib

# Create directory structure
mkdir -p data templates logs
```

---

## STEP 3: Create a Discord Bot

1. Go to https://discord.com/developers/applications
2. Click **"New Application"** → Name it **"JobHunter Bot"**
3. Go to **Bot** tab → Click **"Add Bot"**
4. Turn ON these **Privileged Gateway Intents**:
   - ✅ Message Content Intent
   - ✅ Server Members Intent
   - ✅ Presence Intent
5. Click **"Reset Token"** → Copy the token (save it!)
6. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Read Message History`, `Add Reactions`, `Embed Links`, `Attach Files`, `Use External Emojis`
7. Copy the generated URL → Open in browser → Add bot to your server
8. Create a channel called `#job-alerts` in your Discord server
9. Right-click the channel → **Copy Channel ID** (enable Developer Mode in Discord Settings → Advanced first)

---

## STEP 4: Get Your Claude API Key

Since you have the $20 Claude subscription, you get API access:

1. Go to https://console.anthropic.com/
2. Click **API Keys** → **Create Key**
3. Copy and save the key

> **Note**: The $20 Pro plan gives you $5/month of API credits. Sonnet is very cheap — tailoring a CV + writing an email costs ~$0.01, so you can do ~500 applications/month.

---

## STEP 5: Set Up Gmail App Password

1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification** (required)
3. Go to https://myaccount.google.com/apppasswords
4. Create an App Password for "Mail" → "Mac"
5. Copy the 16-character password

---

## STEP 6: Configure Environment

```bash
cd ~/jobhunter-bot
```

Create the `.env` file (see the generated .env.example file) and fill in your values.

---

## STEP 7: Place Your Master CV

Put your master CV as a `.pdf` or `.docx` file at:
```
~/jobhunter-bot/data/master_cv.pdf
```

Also create a plain text version for the AI to read:
```
~/jobhunter-bot/data/master_cv.txt
```

---

## STEP 8: Copy All Bot Files

Copy all the generated `.js` files into `~/jobhunter-bot/`:
- `index.js` (main bot entry)
- `jobScraper.js` (fetches jobs from APIs)
- `jobRanker.js` (uses Ollama to rank jobs)
- `cvTailor.js` (uses Claude to customize CV)
- `emailSender.js` (sends customized emails)
- `discordHandler.js` (Discord interaction logic)
- `config.js` (configuration)

---

## STEP 9: Start the Bot

```bash
cd ~/jobhunter-bot

# Start Ollama in background (if not running)
ollama serve &

# Start the bot
node index.js
```

---

## STEP 10: Run on Startup (Auto-start)

Create a LaunchAgent so the bot starts when your Mac boots:

```bash
# Create the plist file
cat > ~/Library/LaunchAgents/com.jobhunter.bot.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.jobhunter.bot</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/node</string>
        <string>/Users/YOUR_USERNAME/jobhunter-bot/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/YOUR_USERNAME/jobhunter-bot</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/jobhunter-bot/logs/bot.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/jobhunter-bot/logs/bot-error.log</string>
</dict>
</plist>
EOF

# Replace YOUR_USERNAME
sed -i '' "s/YOUR_USERNAME/$(whoami)/g" ~/Library/LaunchAgents/com.jobhunter.bot.plist

# Load it
launchctl load ~/Library/LaunchAgents/com.jobhunter.bot.plist
```

---

## How It Works (Daily Flow)

1. **9:00 AM** — Bot scrapes jobs from all sources
2. **Ollama ranks** the jobs against your profile (from master CV)
3. **Top 3 jobs** are posted to `#job-alerts` with rich embeds
4. **You react with 👍** on any job you like
5. **Claude Sonnet** tailors your CV for that specific job
6. **Claude Sonnet** writes a personalized cover email
7. **Bot sends** the email with tailored CV attached
8. **Bot confirms** in Discord with a ✅

---

## Discord Commands

| Command | Description |
|---------|-------------|
| `!status` | Check bot health and stats |
| `!search <query>` | Manual job search |
| `!preferences` | Update job preferences |
| `!history` | View application history |
| `!pause` | Pause daily alerts |
| `!resume` | Resume daily alerts |
