const axios = require('axios');
const config = require('./config');
const fs = require('fs');

class JobScraper {
  constructor() {
    this.appliedJobs = this._loadAppliedJobs();
  }

  _loadAppliedJobs() {
    try {
      if (fs.existsSync(config.paths.appliedJobs)) {
        return JSON.parse(fs.readFileSync(config.paths.appliedJobs, 'utf-8'));
      }
    } catch (e) { /* ignore */ }
    return [];
  }

  _isAlreadyApplied(jobId) {
    return this.appliedJobs.some(j => j.id === jobId);
  }

  /**
   * Fetch from RemoteOK API (free, no key needed)
   */
  async fetchRemoteOK() {
    const jobs = [];
    try {
      const { data } = await axios.get('https://remoteok.com/api', {
        headers: { 'User-Agent': 'JobHunterBot/1.0' },
        timeout: 15000,
      });

      // First element is metadata, skip it
      const listings = Array.isArray(data) ? data.slice(1) : [];

      for (const job of listings) {
        const title = (job.position || '').toLowerCase();
        const matchesTitle = config.jobs.titles.some(t =>
          title.includes(t.toLowerCase())
        );

        if (!matchesTitle) continue;

        jobs.push({
          id: `remoteok-${job.id}`,
          title: job.position,
          company: job.company,
          location: job.location || 'Remote',
          salary: job.salary || 'Not specified',
          description: (job.description || '').replace(/<[^>]*>/g, '').substring(0, 2000),
          url: job.url || `https://remoteok.com/remote-jobs/${job.slug}`,
          source: 'RemoteOK',
          postedAt: job.date,
          tags: job.tags || [],
          applyUrl: job.apply_url || job.url,
          recruiterEmail: null,
        });
      }
    } catch (err) {
      console.error('[RemoteOK] Error:', err.message);
    }
    return jobs;
  }

  /**
   * Fetch from Arbeitnow API (free, no key needed)
   */
  async fetchArbeitnow() {
    const jobs = [];
    try {
      const { data } = await axios.get('https://www.arbeitnow.com/api/job-board-api', {
        timeout: 15000,
      });

      const listings = data.data || [];

      for (const job of listings) {
        const title = (job.title || '').toLowerCase();
        const matchesTitle = config.jobs.titles.some(t =>
          title.includes(t.toLowerCase())
        );

        if (!matchesTitle) continue;

        const locationMatch = job.remote ||
          config.jobs.locations.some(l =>
            (job.location || '').toLowerCase().includes(l.toLowerCase())
          );

        if (!locationMatch) continue;

        jobs.push({
          id: `arbeitnow-${job.slug}`,
          title: job.title,
          company: job.company_name,
          location: job.remote ? 'Remote' : (job.location || 'Unknown'),
          salary: job.salary || 'Not specified',
          description: (job.description || '').replace(/<[^>]*>/g, '').substring(0, 2000),
          url: job.url,
          source: 'Arbeitnow',
          postedAt: job.created_at,
          tags: job.tags || [],
          applyUrl: job.url,
          recruiterEmail: null,
        });
      }
    } catch (err) {
      console.error('[Arbeitnow] Error:', err.message);
    }
    return jobs;
  }

  /**
   * Fetch from JSearch API (RapidAPI - free tier: 500 requests/month)
   * This covers LinkedIn, Indeed, Glassdoor jobs
   */
  async fetchJSearch() {
    const jobs = [];

    // Skip if no RapidAPI key configured
    if (!process.env.RAPIDAPI_KEY) {
      console.log('[JSearch] No RAPIDAPI_KEY set, skipping. Get free key at rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch');
      return jobs;
    }

    try {
      for (const title of config.jobs.titles.slice(0, 2)) { // Limit queries to save free tier
        const { data } = await axios.get('https://jsearch.p.rapidapi.com/search', {
          params: {
            query: `${title} ${config.jobs.locations[0] || 'remote'}`,
            page: 1,
            num_pages: 1,
            date_posted: 'week',
          },
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
          },
          timeout: 15000,
        });

        const listings = data.data || [];

        for (const job of listings) {
          if (config.jobs.excludedCompanies.some(c =>
            (job.employer_name || '').toLowerCase().includes(c.toLowerCase())
          )) continue;

          jobs.push({
            id: `jsearch-${job.job_id}`,
            title: job.job_title,
            company: job.employer_name,
            location: job.job_is_remote ? 'Remote' : (job.job_city || job.job_country || 'Unknown'),
            salary: job.job_min_salary
              ? `$${job.job_min_salary} - $${job.job_max_salary}`
              : 'Not specified',
            description: (job.job_description || '').substring(0, 2000),
            url: job.job_apply_link || job.job_google_link,
            source: job.job_publisher || 'JSearch',
            postedAt: job.job_posted_at_datetime_utc,
            tags: [],
            applyUrl: job.job_apply_link,
            recruiterEmail: null,
          });
        }

        // Rate limit protection
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error('[JSearch] Error:', err.message);
    }
    return jobs;
  }

  /**
   * Fetch from Adzuna API (free tier: 250 requests/month)
   */
  async fetchAdzuna() {
    const jobs = [];
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;

    if (!appId || !appKey) {
      console.log('[Adzuna] No ADZUNA_APP_ID/KEY set, skipping. Get free key at developer.adzuna.com');
      return jobs;
    }

    try {
      for (const title of config.jobs.titles.slice(0, 2)) {
        const { data } = await axios.get(
          `https://api.adzuna.com/v1/api/jobs/gb/search/1`, {
            params: {
              app_id: appId,
              app_key: appKey,
              what: title,
              max_days_old: 7,
              results_per_page: 10,
              content_type: 'application/json',
            },
            timeout: 15000,
          }
        );

        for (const job of (data.results || [])) {
          jobs.push({
            id: `adzuna-${job.id}`,
            title: job.title,
            company: job.company?.display_name || 'Unknown',
            location: job.location?.display_name || 'Unknown',
            salary: job.salary_min
              ? `£${Math.round(job.salary_min)} - £${Math.round(job.salary_max)}`
              : 'Not specified',
            description: (job.description || '').substring(0, 2000),
            url: job.redirect_url,
            source: 'Adzuna',
            postedAt: job.created,
            tags: [job.category?.label].filter(Boolean),
            applyUrl: job.redirect_url,
            recruiterEmail: null,
          });
        }

        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error('[Adzuna] Error:', err.message);
    }
    return jobs;
  }

  /**
   * Fetch all jobs from all sources, deduplicate, filter already-applied
   */
  async fetchAllJobs() {
    console.log('[Scraper] Fetching jobs from all sources...');

    const results = await Promise.allSettled([
      this.fetchRemoteOK(),
      this.fetchArbeitnow(),
      this.fetchJSearch(),
      this.fetchAdzuna(),
    ]);

    let allJobs = [];
    const sourceStats = {};

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const jobs = result.value;
        if (jobs.length > 0) {
          sourceStats[jobs[0].source] = jobs.length;
          allJobs = allJobs.concat(jobs);
        }
      }
    }

    // Deduplicate by title+company
    const seen = new Set();
    const uniqueJobs = allJobs.filter(job => {
      const key = `${job.title.toLowerCase()}-${job.company.toLowerCase()}`;
      if (seen.has(key) || this._isAlreadyApplied(job.id)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[Scraper] Found ${uniqueJobs.length} unique jobs from ${Object.keys(sourceStats).length} sources`);
    console.log('[Scraper] Source breakdown:', sourceStats);

    // Cache jobs
    try {
      fs.writeFileSync(config.paths.jobCache, JSON.stringify(uniqueJobs, null, 2));
    } catch (e) { /* ignore */ }

    return uniqueJobs;
  }
}

module.exports = JobScraper;
