require('dotenv').config();

module.exports = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    channelId: process.env.DISCORD_CHANNEL_ID,
    userId: process.env.DISCORD_USER_ID,
  },
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
  },
  email: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    fromName: process.env.EMAIL_FROM_NAME,
  },
  jobs: {
    titles: (process.env.JOB_TITLES || '').split(',').map(s => s.trim()).filter(Boolean),
    locations: (process.env.JOB_LOCATIONS || '').split(',').map(s => s.trim()).filter(Boolean),
    experienceLevel: (process.env.JOB_EXPERIENCE_LEVEL || 'mid').split(',').map(s => s.trim()),
    excludedCompanies: (process.env.EXCLUDED_COMPANIES || '').split(',').map(s => s.trim()).filter(Boolean),
    minSalary: parseInt(process.env.MIN_SALARY || '0', 10),
  },
  schedule: {
    dailyScanTime: process.env.DAILY_SCAN_TIME || '09:00',
    timezone: process.env.TIMEZONE || 'Asia/Karachi',
  },
  ollama: {
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
  },
  paths: {
    masterCv: process.env.MASTER_CV_PATH || './data/master_cv.pdf',
    masterCvText: process.env.MASTER_CV_TEXT_PATH || './data/master_cv.txt',
    appliedJobs: './data/applied_jobs.json',
    jobCache: './data/job_cache.json',
  },
};
