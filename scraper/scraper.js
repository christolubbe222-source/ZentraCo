'use strict';

require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// ─── CONFIG ────────────────────────────────────────────────────────────────

const SEARCHES = [
  // Week 1: Charlotte + Raleigh
  { query: 'medical spa Charlotte NC',           city: 'Charlotte', niche: 'Med Spa' },
  { query: 'aesthetics clinic Charlotte NC',     city: 'Charlotte', niche: 'Med Spa' },
  { query: 'botox clinic Charlotte NC',          city: 'Charlotte', niche: 'Med Spa' },
  { query: 'roofing contractor Charlotte NC',    city: 'Charlotte', niche: 'Roofing' },
  { query: 'roof replacement Charlotte NC',      city: 'Charlotte', niche: 'Roofing' },
  { query: 'HVAC contractor Charlotte NC',       city: 'Charlotte', niche: 'HVAC' },
  { query: 'medical spa Raleigh NC',             city: 'Raleigh',   niche: 'Med Spa' },
  { query: 'aesthetics clinic Raleigh NC',       city: 'Raleigh',   niche: 'Med Spa' },
  { query: 'roofing contractor Raleigh NC',      city: 'Raleigh',   niche: 'Roofing' },
  { query: 'HVAC contractor Raleigh NC',         city: 'Raleigh',   niche: 'HVAC' },
  // Week 2: Nashville + Jacksonville
  { query: 'medical spa Nashville TN',           city: 'Nashville',     niche: 'Med Spa' },
  { query: 'roofing contractor Nashville TN',    city: 'Nashville',     niche: 'Roofing' },
  { query: 'medical spa Jacksonville FL',        city: 'Jacksonville',  niche: 'Med Spa' },
  { query: 'roofing contractor Jacksonville FL', city: 'Jacksonville',  niche: 'Roofing' },
  // Week 3: Colorado Springs
  { query: 'medical spa Colorado Springs CO',    city: 'Colorado Springs', niche: 'Med Spa' },
  { query: 'roofing contractor Colorado Springs CO', city: 'Colorado Springs', niche: 'Roofing' },
];

// Scoring rules — what counts as a high-value observation
const OBSERVATIONS = {
  noBookingWidget:   'No online booking on website — only phone/contact form',
  noGoogleResponse:  'Google reviews with no owner responses',
  fewReviews:        'Active business but under 20 Google reviews',
  noInstagram:       'No Instagram link found on website',
  basicSite:         'Single-page or very thin website',
  noHttps:           'Website not secure (no HTTPS)',
};

// ─── GOOGLE PLACES ──────────────────────────────────────────────────────────

async function searchPlaces(query) {
  const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
  try {
    const res = await axios.get(url, {
      params: { query, key: GOOGLE_API_KEY },
    });
    return res.data.results || [];
  } catch (e) {
    console.error(`Places search failed for "${query}":`, e.message);
    return [];
  }
}

async function getPlaceDetails(placeId) {
  const url = 'https://maps.googleapis.com/maps/api/place/details/json';
  try {
    const res = await axios.get(url, {
      params: {
        place_id: placeId,
        fields: 'name,formatted_phone_number,website,rating,user_ratings_total,reviews,url',
        key: GOOGLE_API_KEY,
      },
    });
    return res.data.result || {};
  } catch (e) {
    console.error(`Place details failed for ${placeId}:`, e.message);
    return {};
  }
}

// ─── WEBSITE SCRAPER ────────────────────────────────────────────────────────

async function scrapeWebsite(url) {
  if (!url) return {};
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
      maxRedirects: 5,
    });
    const $ = cheerio.load(res.data);
    const html = res.data.toLowerCase();

    // Extract email
    const emailMatch = res.data.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
    const emails = emailMatch
      ? [...new Set(emailMatch.filter(e =>
          !e.includes('example') && !e.includes('sentry') &&
          !e.includes('wix') && !e.includes('wordpress') &&
          !e.includes('schema') && !e.includes('@2') &&
          !e.includes('.png') && !e.includes('.jpg')
        ))]
      : [];

    // Extract Instagram
    const igMatch = res.data.match(/instagram\.com\/([a-zA-Z0-9._]+)/g);
    const instagram = igMatch ? igMatch[0].replace('instagram.com/', '@') : '';

    // Detect booking widgets
    const hasBooking = html.includes('book') || html.includes('schedule') ||
                       html.includes('appointment') || html.includes('calendly') ||
                       html.includes('vagaro') || html.includes('mindbody') ||
                       html.includes('fresha') || html.includes('acuity') ||
                       html.includes('booksy') || html.includes('zenoti');

    // Detect live chat
    const hasChat = html.includes('intercom') || html.includes('drift') ||
                    html.includes('tidio') || html.includes('crisp') ||
                    html.includes('livechat') || html.includes('tawk');

    const isHttps = url.startsWith('https');
    const pageText = $('body').text().replace(/\s+/g, ' ').substring(0, 500);

    return {
      email: emails[0] || '',
      allEmails: emails.slice(0, 3).join(' | '),
      instagram,
      hasBooking,
      hasChat,
      isHttps,
      pageText,
    };
  } catch (e) {
    return { scrapeError: e.message.substring(0, 60) };
  }
}

// ─── SCORING + OBSERVATION ──────────────────────────────────────────────────

function scoreAndObserve(details, siteData, reviewsHaveResponses) {
  const observations = [];
  let score = 0;

  if (!siteData.hasBooking) {
    observations.push(OBSERVATIONS.noBookingWidget);
    score += 3;
  }
  if (!reviewsHaveResponses && details.user_ratings_total > 0) {
    observations.push(OBSERVATIONS.noGoogleResponse);
    score += 2;
  }
  if (details.user_ratings_total < 20 && details.user_ratings_total > 0) {
    observations.push(OBSERVATIONS.fewReviews);
    score += 1;
  }
  if (!siteData.instagram) {
    observations.push(OBSERVATIONS.noInstagram);
    score += 1;
  }
  if (!siteData.isHttps) {
    observations.push(OBSERVATIONS.noHttps);
    score += 2;
  }
  if (!siteData.hasChat) {
    score += 1;
  }

  return {
    score,
    observation: observations[0] || 'Review manually',
    allObservations: observations.join(' | '),
  };
}

// ─── DEDUP ──────────────────────────────────────────────────────────────────

function dedupe(leads) {
  const seen = new Set();
  return leads.filter(l => {
    const key = (l.businessName || '').toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function run() {
  if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
    console.error('\n ERROR: Add your Google Places API key to zentra-scraper/.env\n');
    console.error(' Get one free at: https://console.cloud.google.com/apis/library/places-backend.googleapis.com');
    console.error(' Free tier: $200/month credit — more than enough for hundreds of searches\n');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const cityFilter = args[0]; // optional: node scraper.js Charlotte
  const searchList = cityFilter
    ? SEARCHES.filter(s => s.city.toLowerCase().includes(cityFilter.toLowerCase()))
    : SEARCHES;

  console.log(`\n Zentra Co Lead Scraper`);
  console.log(` Searches: ${searchList.length} | Estimated leads: ${searchList.length * 15}-${searchList.length * 20}\n`);

  const allLeads = [];

  for (const search of searchList) {
    console.log(` Searching: ${search.query}...`);
    const places = await searchPlaces(search.query);
    console.log(`   Found ${places.length} places`);

    for (const place of places) {
      try {
        const details = await getPlaceDetails(place.place_id);
        await sleep(200); // gentle rate limiting

        const website = details.website || '';
        const siteData = website ? await scrapeWebsite(website) : {};

        // Check if any reviews have owner responses
        const reviews = details.reviews || [];
        const reviewsHaveResponses = reviews.some(r => r.author_name);

        const { score, observation, allObservations } = scoreAndObserve(details, siteData, reviewsHaveResponses);

        // Skip chains and franchises (too many reviews = chain)
        if (details.user_ratings_total > 500) continue;

        allLeads.push({
          businessName:    details.name || '',
          city:            search.city,
          niche:           search.niche,
          phone:           details.formatted_phone_number || '',
          website:         website,
          email:           siteData.email || '',
          instagram:       siteData.instagram || '',
          googleRating:    details.rating || '',
          reviewCount:     details.user_ratings_total || 0,
          hasBooking:      siteData.hasBooking ? 'YES' : 'NO',
          hasChat:         siteData.hasChat ? 'YES' : 'NO',
          score:           score,
          observation:     observation,
          allObservations: allObservations,
          googleMapsUrl:   details.url || '',
          status:          '',
          warmed:          '',
          dmSent:          '',
          emailSent:       '',
          replied:         '',
          callBooked:      '',
          outcome:         '',
        });
      } catch (e) {
        console.error(`   Error on ${place.name}:`, e.message.substring(0, 60));
      }
    }

    await sleep(500);
  }

  const unique = dedupe(allLeads);

  // Sort by score descending — highest opportunity first
  unique.sort((a, b) => b.score - a.score);

  const timestamp = new Date().toISOString().slice(0, 10);
  const cityLabel = cityFilter || 'all-cities';
  const outFile = path.join(__dirname, `leads-${cityLabel}-${timestamp}.csv`);

  const csvWriter = createObjectCsvWriter({
    path: outFile,
    header: [
      { id: 'businessName',    title: 'Business Name' },
      { id: 'city',            title: 'City' },
      { id: 'niche',           title: 'Niche' },
      { id: 'score',           title: 'Score (higher = better)' },
      { id: 'observation',     title: 'Specific Observation (use in DM/email)' },
      { id: 'allObservations', title: 'All Observations' },
      { id: 'phone',           title: 'Phone' },
      { id: 'website',         title: 'Website' },
      { id: 'email',           title: 'Email' },
      { id: 'instagram',       title: 'Instagram' },
      { id: 'googleRating',    title: 'Google Rating' },
      { id: 'reviewCount',     title: 'Review Count' },
      { id: 'hasBooking',      title: 'Has Online Booking?' },
      { id: 'hasChat',         title: 'Has Live Chat?' },
      { id: 'googleMapsUrl',   title: 'Google Maps URL' },
      { id: 'status',          title: 'Status' },
      { id: 'warmed',          title: 'Warmed (date)' },
      { id: 'dmSent',          title: 'DM Sent (date)' },
      { id: 'emailSent',       title: 'Email Sent (date)' },
      { id: 'replied',         title: 'Replied?' },
      { id: 'callBooked',      title: 'Call Booked?' },
      { id: 'outcome',         title: 'Outcome' },
    ],
  });

  await csvWriter.writeRecords(unique);

  console.log(`\n Done!`);
  console.log(` Total leads: ${unique.length}`);
  console.log(` Score 5+:    ${unique.filter(l => l.score >= 5).length} (highest priority)`);
  console.log(` Score 3-4:   ${unique.filter(l => l.score >= 3 && l.score < 5).length}`);
  console.log(` Has email:   ${unique.filter(l => l.email).length}`);
  console.log(` Has Instagram: ${unique.filter(l => l.instagram).length}`);
  console.log(`\n Saved to: ${outFile}`);
  console.log(` Import to Google Sheets: sheets.new → File → Import → Upload\n`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

run().catch(console.error);
