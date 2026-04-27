'use strict';

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const { generateEmail, buildSubjectLine } = require('./emailPersonalizer');
const { enqueueLeads, processQueue, markReplied, getQueueStats, getQueue } = require('./brevoSender');

// In-memory store for current session leads
let sessionLeads = [];
let scrapeClients = []; // SSE clients for live progress

// ─── SEARCH TEMPLATES ───────────────────────────────────────────────────────

const SEARCH_TEMPLATES = {
  'Med Spa':         ['medical spa', 'aesthetics clinic', 'botox clinic', 'laser clinic', 'skin clinic'],
  'Roofing':         ['roofing contractor', 'roof replacement', 'roofing company'],
  'HVAC':            ['HVAC contractor', 'air conditioning repair', 'heating and cooling'],
  'Electrician':     ['electrician', 'electrical contractor', 'electrical services'],
  'Home Inspection': ['home inspector', 'home inspection service', 'property inspector'],
  'Wellness Studio': ['wellness studio', 'yoga studio', 'pilates studio', 'holistic wellness', 'massage therapy studio'],
  'All':             ['medical spa', 'aesthetics clinic', 'roofing contractor', 'HVAC contractor', 'electrician', 'home inspector', 'wellness studio'],
};

const CITIES = [
  'Charlotte NC', 'Raleigh NC', 'Nashville TN',
  'Jacksonville FL', 'Colorado Springs CO',
  'Greenville SC', 'Indianapolis IN', 'Salt Lake City UT',
  'Boise ID', 'Huntsville AL',
];

// ─── SSE — LIVE PROGRESS ────────────────────────────────────────────────────

app.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write('\n'); // flush headers in Express 5 compatible way
  scrapeClients.push(res);
  req.on('close', () => {
    scrapeClients = scrapeClients.filter(c => c !== res);
  });
});

function sendProgress(type, data) {
  const msg = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  scrapeClients.forEach(c => c.write(msg));
}

// ─── API ENDPOINTS ───────────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  res.json({
    hasApiKey: !!(GOOGLE_API_KEY && GOOGLE_API_KEY !== 'YOUR_GOOGLE_PLACES_API_KEY_HERE'),
    cities: CITIES,
    niches: Object.keys(SEARCH_TEMPLATES),
  });
});

app.get('/api/leads', (req, res) => {
  res.json(sessionLeads);
});

app.post('/api/scrape', async (req, res) => {
  const { city, niche } = req.body;
  if (!city || !niche) return res.status(400).json({ error: 'city and niche required' });
  if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
    return res.status(400).json({ error: 'NO_API_KEY' });
  }

  res.json({ started: true });

  // Run async
  runScrape(city, niche).catch(e => {
    sendProgress('error', { message: e.message });
  });
});

app.post('/api/clear', (req, res) => {
  sessionLeads = [];
  res.json({ ok: true });
});

app.get('/api/export', (req, res) => {
  if (!sessionLeads.length) return res.status(400).json({ error: 'No leads to export' });

  const niche = req.query.niche;
  const leads = niche ? sessionLeads.filter(l => l.niche === niche) : sessionLeads;
  if (!leads.length) return res.status(400).json({ error: 'No leads match that filter' });

  const timestamp = new Date().toISOString().slice(0, 10);
  const nicheSlug = niche ? `-${niche.toLowerCase().replace(/\s+/g, '-')}` : '';
  const outFile = path.join(__dirname, `leads-export-${timestamp}.csv`);

  const csvWriter = createObjectCsvWriter({
    path: outFile,
    header: Object.keys(leads[0]).map(id => ({ id, title: id })),
  });

  csvWriter.writeRecords(leads).then(() => {
    res.download(outFile, `zentra-leads${nicheSlug}-${timestamp}.csv`, () => {
      try { fs.unlinkSync(outFile); } catch (_) {}
    });
  });
});

// ─── TEST EMAIL ENDPOINT ─────────────────────────────────────────────────────

const TEST_LEADS = {
  'Med Spa':         { businessName: 'Glow Aesthetics', city: 'Charlotte NC', niche: 'Med Spa',         observation: 'No online booking — losing after-hours leads', hasBooking: 'NO',  reviewCount: 14, website: 'https://glowaesthetics.com' },
  'Roofing':         { businessName: 'Peak Roofing Co',  city: 'Raleigh NC',   niche: 'Roofing',         observation: 'No website at all — needs the full stack',       hasBooking: 'NO',  reviewCount: 8,  website: '' },
  'HVAC':            { businessName: 'Cool Air HVAC',    city: 'Nashville TN', niche: 'HVAC',            observation: 'Google reviews with no owner responses',          hasBooking: 'NO',  reviewCount: 22, website: 'https://coolair.com' },
  'Electrician':     { businessName: 'Bright Wire Electric', city: 'Jacksonville FL', niche: 'Electrician', observation: 'No website at all — needs the full stack',    hasBooking: 'NO',  reviewCount: 5,  website: '' },
  'Home Inspection': { businessName: 'Solid Ground Inspections', city: 'Greenville SC', niche: 'Home Inspection', observation: 'No Instagram linked on website',       hasBooking: 'NO',  reviewCount: 11, website: 'https://solidgroundinspect.com' },
  'Wellness Studio': { businessName: 'Inner Flow Studio', city: 'Boise ID',    niche: 'Wellness Studio', observation: 'No online booking — losing after-hours leads', hasBooking: 'NO',  reviewCount: 18, website: 'https://innerflowstudio.com' },
};

app.post('/api/autopilot/test', async (req, res) => {
  const { niche, emailNum = 1 } = req.body;
  if (!niche) return res.status(400).json({ error: 'niche required' });

  const lead = TEST_LEADS[niche];
  if (!lead) return res.status(400).json({ error: `No test lead for niche: ${niche}` });

  const toEmail = process.env.FROM_EMAIL;

  try {
    const body    = await generateEmail(lead, emailNum);
    const subject = `[TEST – ${niche} Email ${emailNum}] ${buildSubjectLine(lead, emailNum)}`;
    const { sendTestEmail } = require('./brevoSender');
    await sendTestEmail(toEmail, 'Christo', subject, body);
    res.json({ ok: true, to: toEmail, niche, emailNum });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── AUTOPILOT ENDPOINTS ─────────────────────────────────────────────────────

app.get('/api/autopilot/stats', (req, res) => {
  res.json({
    ...getQueueStats(),
    hasBrevoKey: !!(process.env.BREVO_API_KEY),
    hasAnthropicKey: !!(process.env.ANTHROPIC_API_KEY),
    calLink: process.env.CAL_LINK || '',
  });
});

app.get('/api/autopilot/queue', (req, res) => {
  res.json(getQueue());
});

app.post('/api/autopilot/enqueue', async (req, res) => {
  const { leads } = req.body;
  if (!leads || !leads.length) return res.status(400).json({ error: 'No leads provided' });
  const leadsWithEmail = leads.filter(l => l.email);
  if (!leadsWithEmail.length) return res.status(400).json({ error: 'No leads have emails' });
  const total = enqueueLeads(leadsWithEmail);
  res.json({ queued: leadsWithEmail.length, total });
});

app.post('/api/autopilot/run', async (req, res) => {
  res.json({ started: true });
  processQueue(generateEmail, buildSubjectLine, (type, msg) => {
    sendProgress('autopilot', { type, msg });
  });
});

app.post('/api/autopilot/replied', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  markReplied(email);
  res.json({ ok: true });
});

app.post('/api/config/save', (req, res) => {
  const { anthropic, brevo, cal } = req.body;
  const envPath = path.join(__dirname, '.env');
  let env = fs.readFileSync(envPath, 'utf8');
  if (anthropic) env = env.replace(/ANTHROPIC_API_KEY=.*/, `ANTHROPIC_API_KEY=${anthropic}`);
  if (brevo)     env = env.replace(/BREVO_API_KEY=.*/,    `BREVO_API_KEY=${brevo}`);
  if (cal)       env = env.replace(/CAL_LINK=.*/,         `CAL_LINK=${cal}`);
  fs.writeFileSync(envPath, env);
  // Reload into process.env immediately — no restart needed
  require('dotenv').config({ path: envPath, override: true });
  res.json({ ok: true });
});

// ─── SCRAPE LOGIC ────────────────────────────────────────────────────────────

async function runScrape(city, niche) {
  const queries = (SEARCH_TEMPLATES[niche] || SEARCH_TEMPLATES['All'])
    .map(q => `${q} ${city}`);

  sendProgress('start', { city, niche, total: queries.length });

  const newLeads = [];
  const seen = new Set(sessionLeads.map(l => l.businessName.toLowerCase()));

  for (let qi = 0; qi < queries.length; qi++) {
    const query = queries[qi];
    sendProgress('searching', { query, step: qi + 1, total: queries.length });

    const places = await searchPlaces(query);

    for (const place of places) {
      const placeName = place.displayName?.text || place.name || '';
      if (seen.has(placeName.toLowerCase())) continue;

      sendProgress('processing', { name: placeName });

      try {
        const details = extractDetails(place);
        await sleep(150);

        if ((details.user_ratings_total || 0) > 600) continue; // skip chains

        const website = details.website || '';
        const siteData = website ? await scrapeWebsite(website) : {};
        const reviews = details.reviews || [];
        const ownerResponded = reviews.some(r => r.authorAttribution?.displayName);

        const { score, observation, allObservations } = scoreAndObserve(details, siteData, ownerResponded, website);

        const lead = {
          businessName:    details.name || placeName || '',
          city,
          niche,
          score,
          observation,
          allObservations,
          phone:           details.formatted_phone_number || '',
          website,
          email:           siteData.email || '',
          instagram:       siteData.instagram || '',
          googleRating:    details.rating || '',
          reviewCount:     details.user_ratings_total || 0,
          hasBooking:      siteData.hasBooking ? 'YES' : 'NO',
          hasChat:         siteData.hasChat ? 'YES' : 'NO',
          googleMapsUrl:   details.url || '',
          status:          '',
          warmed:          '',
          dmSent:          '',
          emailSent:       '',
          replied:         '',
          callBooked:      '',
          outcome:         '',
        };

        seen.add(placeName.toLowerCase());
        newLeads.push(lead);
        sessionLeads.push(lead);

        sendProgress('lead', { lead });
      } catch (e) {
        sendProgress('skip', { name: place.name, reason: e.message.substring(0, 50) });
      }
    }

    await sleep(300);
  }

  // Sort session leads by score
  sessionLeads.sort((a, b) => b.score - a.score);

  sendProgress('done', {
    total: newLeads.length,
    withEmail: newLeads.filter(l => l.email).length,
    withInstagram: newLeads.filter(l => l.instagram).length,
    highPriority: newLeads.filter(l => l.score >= 5).length,
  });
}

// ─── GOOGLE PLACES (New API v1) ───────────────────────────────────────────────

async function searchPlaces(query) {
  try {
    const res = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      { textQuery: query, pageSize: 20 },
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.reviews',
          'Content-Type': 'application/json',
        },
      }
    );
    return res.data.places || [];
  } catch (e) {
    console.error('Places search failed:', e.response?.data?.error?.message || e.message);
    return [];
  }
}

// New API returns everything in one call — no separate details needed
function extractDetails(place) {
  return {
    name:                   place.displayName?.text || '',
    formatted_phone_number: place.nationalPhoneNumber || '',
    website:                place.websiteUri || '',
    rating:                 place.rating || '',
    user_ratings_total:     place.userRatingCount || 0,
    reviews:                place.reviews || [],
    url:                    place.googleMapsUri || '',
    id:                     place.id || '',
  };
}

// ─── WEBSITE SCRAPER ─────────────────────────────────────────────────────────

async function scrapeWebsite(url) {
  if (!url) return {};
  try {
    const res = await axios.get(url, {
      timeout: 7000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
      maxRedirects: 4,
    });
    const html = res.data;
    const lower = html.toLowerCase();

    const emailMatch = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
    const email = emailMatch.find(e =>
      !e.includes('example') && !e.includes('sentry') && !e.includes('wix') &&
      !e.includes('wordpress') && !e.includes('schema') && !e.includes('@2') &&
      !e.match(/\.(png|jpg|gif|svg)$/)
    ) || '';

    const igMatch = html.match(/instagram\.com\/([a-zA-Z0-9._]{1,30})/);
    const instagram = igMatch ? '@' + igMatch[1] : '';

    const hasBooking = ['book', 'schedule an appointment', 'book now', 'book online',
      'calendly', 'vagaro', 'mindbody', 'fresha', 'acuity', 'booksy', 'zenoti',
      'jane app', 'square appointments'].some(k => lower.includes(k));

    const hasChat = ['intercom', 'drift', 'tidio', 'crisp', 'livechat', 'tawk', 'zendesk'].some(k => lower.includes(k));

    return { email, instagram, hasBooking, hasChat, isHttps: url.startsWith('https') };
  } catch (_) {
    return {};
  }
}

// ─── SCORING ─────────────────────────────────────────────────────────────────

function scoreAndObserve(details, siteData, ownerResponded, website) {
  const obs = [];
  let score = 0;

  if (!website) {
    obs.push('No website at all — needs the full stack');
    score += 5;
  } else {
    if (!siteData.hasBooking) { obs.push('No online booking — losing after-hours leads'); score += 3; }
    if (siteData.isHttps === false) { obs.push('Website not secure (no HTTPS)'); score += 2; }
    if (!siteData.instagram) { obs.push('No Instagram linked on website'); score += 1; }
    if (!siteData.hasChat) score += 1;
  }

  if (!ownerResponded && (details.user_ratings_total || 0) > 0) { obs.push('Google reviews with no owner responses'); score += 2; }
  if ((details.user_ratings_total || 0) < 20 && (details.user_ratings_total || 0) > 0) { obs.push('Under 20 Google reviews despite being active'); score += 1; }

  return {
    score,
    observation: obs[0] || 'Review manually',
    allObservations: obs.join(' | '),
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── START ───────────────────────────────────────────────────────────────────

// Autopilot runs every 10 minutes
setInterval(() => {
  processQueue(generateEmail, buildSubjectLine, (type, msg) => {
    sendProgress('autopilot', { type, msg });
    console.log(`[autopilot] ${msg}`);
  });
}, 10 * 60 * 1000);

// Serve static files AFTER all API routes — index:false prevents index.html from catching /api/* routes
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n Zentra Lead Scraper running at http://localhost:${PORT}\n`);
  try {
    require('child_process').exec(`start http://localhost:${PORT}/`);
  } catch (_) {}
});
