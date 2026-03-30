const axios = require('axios');
const fs = require('fs');
const config = require('./config');

class LinkedInNetworker {
  constructor() {
    this.cvText = '';
    this.connectionsLog = this._loadLog();
    this._loadCV();
  }

  _loadCV() {
    try {
      this.cvText = fs.readFileSync(config.paths.masterCvText, 'utf-8');
    } catch (e) {
      console.error('[Networker] Could not load CV text');
    }
  }

  _loadLog() {
    const logPath = './data/connections_log.json';
    try {
      if (fs.existsSync(logPath)) {
        return JSON.parse(fs.readFileSync(logPath, 'utf-8'));
      }
    } catch (e) { /* ignore */ }
    return { people: [], companies: [], dailyStats: [] };
  }

  _saveLog() {
    fs.writeFileSync('./data/connections_log.json', JSON.stringify(this.connectionsLog, null, 2));
  }

  /**
   * Call Ollama to generate targeted search queries and connection notes
   */
  async _callOllama(prompt) {
    try {
      const { data } = await axios.post(`${config.ollama.url}/api/generate`, {
        model: config.ollama.model,
        prompt,
        stream: false,
        options: { temperature: 0.4, num_predict: 2000 },
      }, { timeout: 90000 });
      return data.response || '';
    } catch (err) {
      console.error('[Networker/Ollama] Error:', err.message);
      throw err;
    }
  }

  /**
   * Generate targeted LinkedIn search queries based on today's top jobs
   */
  async generateSearchTargets(topJobs) {
    const jobContext = topJobs.map(j =>
      `- ${j.title} at ${j.company} (${j.location})`
    ).join('\n');

    const prompt = `You are a LinkedIn networking strategist. Based on the candidate's profile and today's target jobs, generate search targets for LinkedIn networking.

CANDIDATE PROFILE:
${this.cvText.substring(0, 1200)}

TODAY'S TARGET JOBS:
${jobContext}

Generate EXACTLY this JSON structure (no other text):
{
  "people_searches": [
    {
      "query": "LinkedIn search URL query string for finding this person type",
      "role_type": "e.g. Engineering Manager, Tech Lead, Recruiter",
      "company": "target company or 'any'",
      "reason": "why connecting with this person helps",
      "connection_note": "A short, personalized 300-char max connection request message. Be genuine, mention shared interests or mutual value. Never be salesy."
    }
  ],
  "company_searches": [
    {
      "company_name": "Company Name",
      "linkedin_search": "search query to find this company page",
      "reason": "why following this company helps",
      "industry": "their industry"
    }
  ],
  "industry_keywords": ["keyword1", "keyword2", "keyword3"]
}

RULES:
- Generate 10 people search entries (mix of: 3 recruiters at target companies, 3 hiring managers, 2 senior engineers, 2 industry thought leaders)
- Generate 5 company search entries
- Connection notes must be GENUINE, SHORT (under 300 chars), and PERSONALIZED
- Never use phrases like "I'd love to pick your brain" or "I noticed your impressive profile"
- Focus on shared technical interests, mutual communities, or specific work they've done
- Include the candidate's actual skills in the connection notes`;

    const response = await this._callOllama(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Ollama did not return valid JSON for search targets');
    return JSON.parse(jsonMatch[0]);
  }

  /**
   * Generate the actual LinkedIn search URLs
   */
  buildSearchURLs(targets) {
    const urls = {
      people: [],
      companies: [],
    };

    for (const person of (targets.people_searches || [])) {
      // Build LinkedIn people search URL
      const keywords = encodeURIComponent(person.role_type + ' ' + (person.company !== 'any' ? person.company : ''));
      urls.people.push({
        url: `https://www.linkedin.com/search/results/people/?keywords=${keywords}&origin=GLOBAL_SEARCH_HEADER`,
        ...person,
      });
    }

    for (const company of (targets.company_searches || [])) {
      const keywords = encodeURIComponent(company.company_name);
      urls.companies.push({
        url: `https://www.linkedin.com/search/results/companies/?keywords=${keywords}&origin=GLOBAL_SEARCH_HEADER`,
        ...company,
      });
    }

    return urls;
  }

  /**
   * Generate a browser automation script for Claude in Chrome
   * This creates step-by-step instructions that can be executed via the browser
   */
  generateAutomationScript(searchURLs) {
    const script = {
      type: 'linkedin_networking',
      created: new Date().toISOString(),
      steps: [],
    };

    // People connections (up to 50 per day, but we'll be conservative)
    let peopleCount = 0;
    for (const person of searchURLs.people) {
      if (peopleCount >= 50) break;

      // Each search result page shows ~10 results, we'll connect with 5 per search
      for (let i = 0; i < 5 && peopleCount < 50; i++) {
        script.steps.push({
          action: 'connect_person',
          searchUrl: person.url,
          resultIndex: i,
          connectionNote: person.connection_note,
          roleType: person.role_type,
          reason: person.reason,
        });
        peopleCount++;
      }
    }

    // Company follows (10 per day)
    let companyCount = 0;
    for (const company of searchURLs.companies) {
      if (companyCount >= 10) break;

      script.steps.push({
        action: 'follow_company',
        searchUrl: company.url,
        companyName: company.company_name,
        reason: company.reason,
      });
      companyCount++;
    }

    return script;
  }

  /**
   * Main orchestration: run the full networking cycle
   * Returns data for Discord reporting
   */
  async runNetworkingCycle(topJobs) {
    console.log('[Networker] Starting daily networking cycle...');

    // Step 1: Use Ollama to generate smart targets
    console.log('[Networker] Generating search targets with Ollama...');
    const targets = await this.generateSearchTargets(topJobs);

    // Step 2: Build search URLs
    const searchURLs = this.buildSearchURLs(targets);

    // Step 3: Generate automation script
    const automationScript = this.generateAutomationScript(searchURLs);

    // Step 4: Save the script for Claude in Chrome to execute
    const scriptPath = './data/today_networking.json';
    fs.writeFileSync(scriptPath, JSON.stringify(automationScript, null, 2));

    // Step 5: Save the connection notes for reference
    const notesPath = './data/today_connection_notes.json';
    fs.writeFileSync(notesPath, JSON.stringify({
      date: new Date().toISOString(),
      targets,
      urls: searchURLs,
    }, null, 2));

    // Step 6: Log today's activity
    const todayStats = {
      date: new Date().toISOString().split('T')[0],
      peopleTargeted: searchURLs.people.length,
      companiesTargeted: searchURLs.companies.length,
      industries: targets.industry_keywords || [],
    };
    this.connectionsLog.dailyStats.push(todayStats);
    this._saveLog();

    console.log(`[Networker] Generated ${searchURLs.people.length} people targets, ${searchURLs.companies.length} company targets`);

    return {
      targets,
      searchURLs,
      automationScript,
      stats: todayStats,
    };
  }

  /**
   * Record completed connections (called after browser automation finishes)
   */
  recordCompletedConnections(peopleConnected, companiesFollowed) {
    const today = new Date().toISOString().split('T')[0];

    for (const person of peopleConnected) {
      this.connectionsLog.people.push({
        ...person,
        date: today,
      });
    }

    for (const company of companiesFollowed) {
      this.connectionsLog.companies.push({
        ...company,
        date: today,
      });
    }

    // Update today's stats
    const todayIndex = this.connectionsLog.dailyStats.findIndex(s => s.date === today);
    if (todayIndex >= 0) {
      this.connectionsLog.dailyStats[todayIndex].peopleConnected = peopleConnected.length;
      this.connectionsLog.dailyStats[todayIndex].companiesFollowed = companiesFollowed.length;
    }

    this._saveLog();

    return {
      totalPeopleAllTime: this.connectionsLog.people.length,
      totalCompaniesAllTime: this.connectionsLog.companies.length,
    };
  }

  /**
   * Get weekly networking summary
   */
  getWeeklySummary() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const cutoff = oneWeekAgo.toISOString().split('T')[0];

    const weekPeople = this.connectionsLog.people.filter(p => p.date >= cutoff);
    const weekCompanies = this.connectionsLog.companies.filter(c => c.date >= cutoff);

    return {
      peopleThisWeek: weekPeople.length,
      companiesThisWeek: weekCompanies.length,
      totalPeopleAllTime: this.connectionsLog.people.length,
      totalCompaniesAllTime: this.connectionsLog.companies.length,
      topIndustries: this._getTopIndustries(),
    };
  }

  _getTopIndustries() {
    const counts = {};
    for (const stat of this.connectionsLog.dailyStats) {
      for (const kw of (stat.industries || [])) {
        counts[kw] = (counts[kw] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([kw]) => kw);
  }
}

module.exports = LinkedInNetworker;
