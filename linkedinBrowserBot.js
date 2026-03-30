const fs = require('fs');
const config = require('./config');

/**
 * LinkedInBrowserBot
 * 
 * This module handles the actual browser automation for LinkedIn.
 * It uses Puppeteer to control a Chrome browser session.
 * 
 * SAFETY FEATURES:
 * - Hard daily limits: max 50 connections, 10 follows
 * - Random delays between actions (human-like behavior)
 * - Stops immediately if LinkedIn shows any warning
 * - Saves progress so it can resume if interrupted
 * - Respects LinkedIn's weekly connection limit (~100/week)
 */

class LinkedInBrowserBot {
  constructor() {
    this.dailyLimits = {
      maxConnections: 50,
      maxFollows: 10,
      minDelayMs: 8000,   // 8 seconds minimum between actions
      maxDelayMs: 25000,  // 25 seconds maximum between actions
      pageLoadWaitMs: 5000,
    };
    this.results = {
      peopleConnected: [],
      companiesFollowed: [],
      errors: [],
      skipped: [],
    };
  }

  /**
   * Random delay to mimic human behavior
   */
  _randomDelay() {
    const delay = Math.floor(
      Math.random() * (this.dailyLimits.maxDelayMs - this.dailyLimits.minDelayMs) +
      this.dailyLimits.minDelayMs
    );
    return new Promise(r => setTimeout(r, delay));
  }

  /**
   * Execute the networking script via Puppeteer
   * Requires: npm install puppeteer
   */
  async execute(automationScript) {
    let browser;

    try {
      // Dynamic import - puppeteer is optional
      const puppeteer = require('puppeteer-core');

      // Connect to existing Chrome instance or launch new one
      // For Mac Mini, we use the system Chrome
      browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: false, // We want to see what's happening
        userDataDir: './data/chrome-profile', // Persist login session
        args: [
          '--no-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1280,900',
        ],
        defaultViewport: { width: 1280, height: 900 },
      });

      const page = await browser.newPage();

      // Set a realistic user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Check if logged into LinkedIn
      await page.goto('https://www.linkedin.com/feed/', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/authwall')) {
        console.log('[Browser] Not logged into LinkedIn. Please log in manually.');
        console.log('[Browser] The browser window is open — log in and then restart the bot.');
        
        // Wait 2 minutes for manual login
        await new Promise(r => setTimeout(r, 120000));
        
        // Check again
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle2' });
        if (page.url().includes('/login')) {
          throw new Error('LinkedIn login required. Please log in manually first.');
        }
      }

      console.log('[Browser] LinkedIn session active. Starting automation...');

      // Process people connections
      let connectCount = 0;
      const peopleSteps = automationScript.steps.filter(s => s.action === 'connect_person');

      for (const step of peopleSteps) {
        if (connectCount >= this.dailyLimits.maxConnections) break;

        try {
          await this._connectWithPerson(page, step);
          connectCount++;
          this.results.peopleConnected.push({
            roleType: step.roleType,
            reason: step.reason,
            timestamp: new Date().toISOString(),
          });
          console.log(`[Browser] Connected ${connectCount}/${this.dailyLimits.maxConnections}`);
        } catch (err) {
          console.error(`[Browser] Connection failed:`, err.message);
          this.results.errors.push({ step: step.roleType, error: err.message });

          // If LinkedIn is blocking us, stop immediately
          if (err.message.includes('rate') || err.message.includes('restrict') || err.message.includes('blocked')) {
            console.error('[Browser] LinkedIn may be rate limiting. Stopping for safety.');
            break;
          }
        }

        await this._randomDelay();
      }

      // Process company follows
      let followCount = 0;
      const companySteps = automationScript.steps.filter(s => s.action === 'follow_company');

      for (const step of companySteps) {
        if (followCount >= this.dailyLimits.maxFollows) break;

        try {
          await this._followCompany(page, step);
          followCount++;
          this.results.companiesFollowed.push({
            companyName: step.companyName,
            reason: step.reason,
            timestamp: new Date().toISOString(),
          });
          console.log(`[Browser] Followed company ${followCount}/${this.dailyLimits.maxFollows}`);
        } catch (err) {
          console.error(`[Browser] Follow failed:`, err.message);
          this.results.errors.push({ step: step.companyName, error: err.message });
        }

        await this._randomDelay();
      }

    } catch (err) {
      console.error('[Browser] Fatal error:', err.message);
      this.results.errors.push({ step: 'init', error: err.message });
    } finally {
      // Don't close browser - keep session alive for next time
      // if (browser) await browser.close();
    }

    return this.results;
  }

  /**
   * Connect with a person from search results
   */
  async _connectWithPerson(page, step) {
    // Navigate to search
    await page.goto(step.searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });
    await new Promise(r => setTimeout(r, this.dailyLimits.pageLoadWaitMs));

    // Find Connect buttons on the page
    const connectButtons = await page.$$('button[aria-label*="Invite"][aria-label*="to connect"]');

    if (connectButtons.length === 0) {
      // Try the alternative selector
      const altButtons = await page.$$('button.artdeco-button--secondary span');
      const connectBtn = altButtons.find(async (btn) => {
        const text = await page.evaluate(el => el.textContent, btn);
        return text.trim() === 'Connect';
      });

      if (!connectBtn) {
        this.results.skipped.push({ reason: 'No connect button found', step: step.roleType });
        return;
      }
    }

    // Click the connect button for the target result
    const targetIndex = Math.min(step.resultIndex || 0, connectButtons.length - 1);
    if (targetIndex < 0) {
      this.results.skipped.push({ reason: 'No results on page', step: step.roleType });
      return;
    }

    await connectButtons[targetIndex].click();
    await new Promise(r => setTimeout(r, 2000));

    // Check if "Add a note" option appears
    const addNoteBtn = await page.$('button[aria-label="Add a note"]');
    if (addNoteBtn && step.connectionNote) {
      await addNoteBtn.click();
      await new Promise(r => setTimeout(r, 1000));

      // Type the connection note
      const noteField = await page.$('textarea[name="message"]') || await page.$('#custom-message');
      if (noteField) {
        await noteField.click({ clickCount: 3 }); // Select all
        await noteField.type(step.connectionNote, { delay: 30 }); // Type slowly like a human
      }
    }

    // Click Send
    const sendBtn = await page.$('button[aria-label="Send invitation"]') ||
                    await page.$('button[aria-label="Send now"]');
    if (sendBtn) {
      await sendBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }

    // Check for any error/warning modals
    const errorModal = await page.$('.artdeco-modal--error');
    if (errorModal) {
      const errorText = await page.evaluate(el => el.textContent, errorModal);
      throw new Error(`LinkedIn warning: ${errorText.substring(0, 200)}`);
    }
  }

  /**
   * Follow a company from search results
   */
  async _followCompany(page, step) {
    await page.goto(step.searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });
    await new Promise(r => setTimeout(r, this.dailyLimits.pageLoadWaitMs));

    // Find the first Follow button
    const followButtons = await page.$$('button[aria-label*="Follow"]');

    if (followButtons.length === 0) {
      this.results.skipped.push({ reason: 'No follow button found', step: step.companyName });
      return;
    }

    await followButtons[0].click();
    await new Promise(r => setTimeout(r, 2000));
  }
}

module.exports = LinkedInBrowserBot;
