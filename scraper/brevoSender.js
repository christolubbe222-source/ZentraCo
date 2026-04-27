'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');

function getEnv() {
  return {
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    FROM_EMAIL:    process.env.FROM_EMAIL    || 'christo@zentra-co.com',
    FROM_NAME:     process.env.FROM_NAME     || 'Christo, Zentra Co',
    CAL_LINK:      process.env.CAL_LINK      || 'https://calendly.com/christolubbe222/30min',
  };
}

// Queue file persists between server restarts
const QUEUE_FILE = path.join(__dirname, 'email-queue.json');

function loadQueue() {
  try { return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); }
  catch (_) { return []; }
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

// Add leads to the sequence queue
function enqueueLeads(leads) {
  const queue = loadQueue();
  const now = Date.now();

  for (const lead of leads) {
    if (!lead.email) continue;
    const alreadyQueued = queue.some(q => q.email === lead.email);
    if (alreadyQueued) continue;

    queue.push({
      id:           `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      email:        lead.email,
      businessName: lead.businessName,
      city:         lead.city,
      niche:        lead.niche,
      observation:  lead.observation,
      website:      lead.website,
      reviewCount:  lead.reviewCount,
      hasBooking:   lead.hasBooking,
      // Schedule: Email 1 now, Email 2 in 5 days, Email 3 in 10 days
      emails: [
        { num: 1, sendAt: now,                         sent: false, opened: false, replied: false },
        { num: 2, sendAt: now + 5 * 24 * 60 * 60 * 1000, sent: false, opened: false, replied: false },
        { num: 3, sendAt: now + 10 * 24 * 60 * 60 * 1000, sent: false, opened: false, replied: false },
      ],
      replied:   false,
      createdAt: now,
    });
  }

  saveQueue(queue);
  return queue.length;
}

// Mark a contact as replied — stops further emails
function markReplied(email) {
  const queue = loadQueue();
  const entry = queue.find(q => q.email === email);
  if (entry) {
    entry.replied = true;
    saveQueue(queue);
  }
}

// Send one email via Brevo
async function sendEmail(to, toName, subject, body) {
  const { BREVO_API_KEY, FROM_EMAIL, FROM_NAME, CAL_LINK } = getEnv();
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not set in .env');

  const htmlBody = body
    .replace(/\[BOOKING_LINK\]/g, `<a href="${CAL_LINK}">${CAL_LINK}</a>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>') +
    `<br><br>
    <p style="color:#888;font-size:12px;font-family:sans-serif">
      Christo Lubbe<br>
      Zentra Co<br>
      <a href="https://zentra-co.com" style="color:#f0bb30">zentra-co.com</a><br><br>
      <a href="[UNSUBSCRIBE]" style="color:#888;font-size:11px">Unsubscribe</a>
    </p>`;

  await axios.post('https://api.brevo.com/v3/smtp/email', {
    sender:  { name: FROM_NAME, email: FROM_EMAIL },
    to:      [{ email: to, name: toName }],
    subject,
    htmlContent: htmlBody,
    headers: { 'X-Mailin-custom': 'zentra-outreach' },
  }, {
    headers: {
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
  });
}

// Process the queue — called on a timer
async function processQueue(generateEmail, buildSubjectLine, onLog) {
  const { BREVO_API_KEY, CAL_LINK } = getEnv();
  if (!BREVO_API_KEY) {
    onLog('warn', 'Brevo API key not set — email autopilot paused');
    return { sent: 0, skipped: 0 };
  }

  const queue = loadQueue();
  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const contact of queue) {
    if (contact.replied) continue;

    for (const emailJob of contact.emails) {
      if (emailJob.sent) continue;
      if (emailJob.sendAt > now) continue;

      // Don't send Email 2 or 3 if they replied
      if (contact.replied) { emailJob.sent = true; continue; }

      try {
        onLog('info', `Generating email ${emailJob.num} for ${contact.businessName}...`);
        const body    = await generateEmail(contact, emailJob.num);
        const subject = buildSubjectLine(contact, emailJob.num);
        const finalBody = body.replace(/\[BOOKING_LINK\]/g, CAL_LINK);

        await sendEmail(contact.email, contact.businessName, subject, finalBody);

        emailJob.sent   = true;
        emailJob.sentAt = now;
        sent++;

        onLog('success', `Sent email ${emailJob.num} to ${contact.businessName} (${contact.email})`);

        // Rate limit — max 40/hour, so ~90s between sends
        await sleep(1500);

      } catch (e) {
        skipped++;
        onLog('error', `Failed to send to ${contact.email}: ${e.message.slice(0, 80)}`);
      }
    }
  }

  saveQueue(queue);
  return { sent, skipped };
}

function getQueueStats() {
  const queue = loadQueue();
  const pending   = queue.filter(q => !q.replied && q.emails.some(e => !e.sent)).length;
  const completed = queue.filter(q => q.emails.every(e => e.sent) || q.replied).length;
  const replied   = queue.filter(q => q.replied).length;
  const total     = queue.length;
  return { total, pending, completed, replied };
}

function getQueue() {
  return loadQueue();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sendTestEmail(to, toName, subject, body) {
  await sendEmail(to, toName, subject, body);
}

module.exports = { enqueueLeads, processQueue, markReplied, getQueueStats, getQueue, sendTestEmail };
