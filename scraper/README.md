# Zentra Lead Scraper

Scrapes Google Maps for local service businesses, checks their website for gaps,
scores them by opportunity, and outputs a ready-to-use CSV.

---

## SETUP (one time, 10 minutes)

### Step 1 — Get a free Google Places API key

1. Go to: https://console.cloud.google.com/
2. Create a new project (call it "Zentra Scraper")
3. Go to APIs & Services > Library
4. Enable: "Places API"
5. Go to APIs & Services > Credentials > Create Credentials > API Key
6. Copy the key

Google gives you $200 free credit/month. Each Places search costs ~$0.032.
200 leads costs roughly $0.64. You won't pay anything.

### Step 2 — Add your key

Open `.env` and replace `YOUR_GOOGLE_PLACES_API_KEY_HERE` with your actual key.

---

## USAGE

Run from the zentra-scraper folder:

```
# Scrape Charlotte + Raleigh (default Week 1 targets)
node scraper.js Charlotte
node scraper.js Raleigh

# Scrape all cities at once
node scraper.js

# Scrape a specific city
node scraper.js Nashville
node scraper.js Jacksonville
```

Then open results in Google Sheets:
```
node open-in-sheets.js
```

---

## OUTPUT

CSV file: `leads-[city]-[date].csv`

Key columns:
- **Score** — higher = more gaps = better prospect (score 5+ = contact first)
- **Specific Observation** — paste this directly into your DM or email opener
- **Has Online Booking** — NO means they're losing after-hours leads
- **Instagram** — pre-filled handle for DM outreach
- **Email** — pre-filled for Brevo cold sequence

---

## PRIORITY GUIDE

| Score | Action |
|---|---|
| 6+ | DM + email immediately |
| 4-5 | DM this week |
| 2-3 | Email sequence only |
| 0-1 | Skip or keep as low priority |

---

## PRICING REMINDER (for when calls come in)

| Niche | Setup | Monthly |
|---|---|---|
| Roofing / HVAC ($500k+ revenue) | $10k-$12k | $1,500 |
| Med Spa / Aesthetics | $6k-$8k | $1,000 |
| Smaller local business | $2k-$3k | $600 |
