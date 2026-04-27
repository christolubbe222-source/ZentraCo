'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Maps scraper niche names to their MD prompt files
const NICHE_PROMPT_MAP = {
  'Med Spa':         'med-spa.md',
  'Roofing':         'roofing.md',
  'HVAC':            'hvac.md',
  'Electrician':     'electrician.md',
  'Home Inspection': 'home-inspection.md',
  'Wellness Studio': 'wellness-studio.md',
};

function loadNichePrompt(niche) {
  const file = NICHE_PROMPT_MAP[niche];
  if (!file) throw new Error(`No email skill found for niche "${niche}". Add a prompt file to niche-prompts/.`);
  const promptPath = path.join(__dirname, 'niche-prompts', file);
  if (!fs.existsSync(promptPath)) throw new Error(`Prompt file missing: niche-prompts/${file}`);
  return fs.readFileSync(promptPath, 'utf8');
}

async function generateEmail(lead, emailNumber = 1) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set in .env');

  const systemPrompt = loadNichePrompt(lead.niche);

  const prompts = {
    1: buildEmail1Prompt(lead),
    2: buildEmail2Prompt(lead),
    3: buildEmail3Prompt(lead),
  };

  const userPrompt = prompts[emailNumber] || prompts[1];

  const res = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  }, {
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
  });

  return res.data.content[0].text.trim();
}

function buildEmail1Prompt(lead) {
  return `Write Email 1 (first cold touch) for this lead:

Business: ${lead.businessName}
City: ${lead.city}
Niche: ${lead.niche}
Specific gap found: ${lead.observation}
Has online booking: ${lead.hasBooking}
Google reviews: ${lead.reviewCount}
Website: ${lead.website || 'none'}

Reference the specific gap (${lead.observation}) naturally in the opening.
Do NOT pitch a product. Surface the problem and ask if it's worth a look.
End with a soft question like: "Worth a quick 15-minute look?" or "Is that something you're working on?"`;
}

function buildEmail2Prompt(lead) {
  return `Write Email 2 (follow-up, 5 days after no reply) for this lead:

Business: ${lead.businessName}
City: ${lead.city}
Niche: ${lead.niche}
Specific gap: ${lead.observation}

Follow-up to a previous email they didn't reply to.
Reference a result from a similar ${lead.niche} business — specific and understated.
End with an offer of a free 15-minute site audit — low pressure.
Different structure and opening from Email 1. No "just following up" opener.`;
}

function buildEmail3Prompt(lead) {
  return `Write Email 3 (final touch, 5 days after Email 2, no reply) for this lead:

Business: ${lead.businessName}
City: ${lead.city}
Niche: ${lead.niche}

Last email. 4-5 sentences max.
Acknowledge it's the last message. Give them an easy out.
Include the booking link placeholder: [BOOKING_LINK]
Tone: warm, no pressure, no desperation. Leave on good terms.`;
}

function buildSubjectLine(lead, emailNumber) {
  const subjects = {
    1: [
      `${lead.businessName} — quick observation`,
      `noticed something on your site`,
      `quick question, ${lead.businessName}`,
    ],
    2: [
      `what we fixed for a similar ${lead.niche.toLowerCase()}`,
      `re: ${lead.businessName}`,
      `a result you might find useful`,
    ],
    3: [
      `last one from me`,
      `leaving this here, ${lead.businessName.split(' ')[0]}`,
      `one more thing`,
    ],
  };

  const options = subjects[emailNumber] || subjects[1];
  return options[Math.floor(Math.random() * options.length)];
}

module.exports = { generateEmail, buildSubjectLine };
