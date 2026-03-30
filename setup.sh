#!/bin/bash

# ═══════════════════════════════════════════════
#  🎯 JobHunter Bot — One-Click Setup Script
#  For Mac Mini M2 (Apple Silicon)
# ═══════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🎯 JobHunter Bot — Setup Script${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo ""

# ─── Check prerequisites ────────────────────────
echo -e "${BLUE}[1/7] Checking prerequisites...${NC}"

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo -e "${YELLOW}Installing Homebrew...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi
echo -e "${GREEN}  ✓ Homebrew installed${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js...${NC}"
    brew install node
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}  ✓ Node.js ${NODE_VERSION}${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Installing Python3...${NC}"
    brew install python3
fi
echo -e "${GREEN}  ✓ Python3 installed${NC}"

# ─── Install Ollama ──────────────────────────────
echo ""
echo -e "${BLUE}[2/7] Setting up Ollama (free local AI)...${NC}"

if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}Installing Ollama...${NC}"
    brew install ollama
fi
echo -e "${GREEN}  ✓ Ollama installed${NC}"

# Start Ollama if not running
if ! pgrep -x "ollama" > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting Ollama...${NC}"
    ollama serve &> /dev/null &
    sleep 3
fi

# Pull the model
echo -e "${YELLOW}Pulling Llama 3.1 8B model (this may take a few minutes on first run)...${NC}"
ollama pull llama3.1:8b
echo -e "${GREEN}  ✓ Llama 3.1 8B ready${NC}"

# ─── Install npm dependencies ───────────────────
echo ""
echo -e "${BLUE}[3/7] Installing Node.js dependencies...${NC}"
npm install
echo -e "${GREEN}  ✓ All dependencies installed${NC}"

# ─── Create data directories ────────────────────
echo ""
echo -e "${BLUE}[4/7] Creating data directories...${NC}"
mkdir -p data logs
echo -e "${GREEN}  ✓ Directories created${NC}"

# ─── Setup .env file ────────────────────────────
echo ""
echo -e "${BLUE}[5/7] Configuring environment...${NC}"

if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo -e "${YELLOW}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  ACTION REQUIRED: Edit your .env file            ║${NC}"
    echo -e "${YELLOW}╠══════════════════════════════════════════════════╣${NC}"
    echo -e "${YELLOW}║                                                  ║${NC}"
    echo -e "${YELLOW}║  Open: ~/jobhunter-bot/.env                      ║${NC}"
    echo -e "${YELLOW}║                                                  ║${NC}"
    echo -e "${YELLOW}║  You MUST fill in:                               ║${NC}"
    echo -e "${YELLOW}║  1. DISCORD_TOKEN (from Discord Dev Portal)      ║${NC}"
    echo -e "${YELLOW}║  2. DISCORD_CHANNEL_ID (right-click channel)     ║${NC}"
    echo -e "${YELLOW}║  3. DISCORD_USER_ID (right-click your name)      ║${NC}"
    echo -e "${YELLOW}║  4. ANTHROPIC_API_KEY (console.anthropic.com)    ║${NC}"
    echo -e "${YELLOW}║  5. EMAIL_USER (your Gmail)                      ║${NC}"
    echo -e "${YELLOW}║  6. EMAIL_PASS (Gmail App Password)              ║${NC}"
    echo -e "${YELLOW}║  7. JOB_TITLES (your target roles)               ║${NC}"
    echo -e "${YELLOW}║                                                  ║${NC}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Edit now with: ${CYAN}nano .env${NC} or ${CYAN}open .env${NC}"
else
    echo -e "${GREEN}  ✓ .env file already exists${NC}"
fi

# ─── Master CV check ────────────────────────────
echo ""
echo -e "${BLUE}[6/7] Checking for master CV...${NC}"

if [ ! -f data/master_cv.txt ]; then
    echo ""
    echo -e "${YELLOW}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  ACTION REQUIRED: Add your Master CV             ║${NC}"
    echo -e "${YELLOW}╠══════════════════════════════════════════════════╣${NC}"
    echo -e "${YELLOW}║                                                  ║${NC}"
    echo -e "${YELLOW}║  1. Copy your CV (PDF) to:                       ║${NC}"
    echo -e "${YELLOW}║     ~/jobhunter-bot/data/master_cv.pdf           ║${NC}"
    echo -e "${YELLOW}║                                                  ║${NC}"
    echo -e "${YELLOW}║  2. Create a plain text version at:              ║${NC}"
    echo -e "${YELLOW}║     ~/jobhunter-bot/data/master_cv.txt           ║${NC}"
    echo -e "${YELLOW}║     (Just paste your CV content as text)          ║${NC}"
    echo -e "${YELLOW}║                                                  ║${NC}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════════╝${NC}"
    
    # Create a template
    cat > data/master_cv.txt << 'CVTEMPLATE'
YOUR FULL NAME
your.email@gmail.com | +92-XXX-XXXXXXX | Lahore, Pakistan
LinkedIn: linkedin.com/in/yourprofile | GitHub: github.com/yourprofile

PROFESSIONAL SUMMARY
[2-3 sentences about your experience and what you're looking for]

TECHNICAL SKILLS
Languages: [e.g., JavaScript, Python, TypeScript, Java]
Frameworks: [e.g., React, Node.js, Django, Express]
Databases: [e.g., PostgreSQL, MongoDB, Redis]
Tools: [e.g., Docker, AWS, Git, CI/CD]

PROFESSIONAL EXPERIENCE

[Job Title] — [Company Name]
[Start Date] - [End Date]
• [Achievement with metrics]
• [Achievement with metrics]
• [Achievement with metrics]

[Job Title] — [Company Name]
[Start Date] - [End Date]
• [Achievement with metrics]
• [Achievement with metrics]

EDUCATION
[Degree] — [University Name] ([Year])

CERTIFICATIONS
• [Certification 1]
• [Certification 2]
CVTEMPLATE
    
    echo -e "${YELLOW}  ⚠ Created template at data/master_cv.txt — please fill it in${NC}"
else
    echo -e "${GREEN}  ✓ Master CV found${NC}"
fi

# ─── Test connections ────────────────────────────
echo ""
echo -e "${BLUE}[7/7] Testing connections...${NC}"

# Test Ollama
echo -n "  Testing Ollama... "
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Connected${NC}"
else
    echo -e "${RED}✗ Not running. Start with: ollama serve${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Next steps:${NC}"
echo -e "  1. Edit ${CYAN}.env${NC} with your tokens and keys"
echo -e "  2. Fill in ${CYAN}data/master_cv.txt${NC} with your CV"
echo -e "  3. Start the bot: ${CYAN}npm start${NC}"
echo ""
echo -e "  ${CYAN}Useful commands:${NC}"
echo -e "  ${CYAN}npm run test-scraper${NC}  — Test job scraping"
echo -e "  ${CYAN}npm run test-email${NC}    — Test email connection"
echo -e "  ${CYAN}npm run test-ollama${NC}   — Test local AI"
echo ""
