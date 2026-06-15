import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

// Must match the key file hosted at https://zentra-co.com/<key>.txt
const INDEXNOW_KEY = "7bd22c2d3898d23ba584b51a7bf45add";

const ELECTRICIAN_TOPICS = [
  "how much does a website cost for an electrician",
  "how to get electrical contracting jobs without referrals",
  "what does a good electrician website need to convert visitors",
  "what questions should I ask before hiring an electrician",
  "how do homeowners find electricians near them",
  "how long does it take to rank on Google as a local electrical contractor",
  "should electricians use Google Ads or SEO to get more jobs",
  "what is the best CRM for electrical contractors",
  "local SEO for electricians how to rank in your city",
  "how to get electrician leads in a new city or service area",
  "Google Business Profile tips for electrical contractors",
  "how to get 5-star reviews as an electrician",
  "how AI can help electricians respond to leads faster",
  "how to automate your electrical business without hiring more staff",
  "AI receptionist vs human receptionist for electrical contractors",
  "how electricians are using AI to book more jobs automatically",
  "electrician website builder vs custom web design which is better",
  "paid ads vs SEO for electrical contractors which gets more leads",
  "in-house marketing vs hiring an agency for electrical contractors",
  "DIY website vs professional web design for electricians",
  "how to choose the best web design agency for electricians",
  "what to look for in an affordable web design agency for electricians",
  "best AI automations every electrician should use in 2026",
  "what does a marketing agency for electricians actually do",
  "is it worth hiring a marketing agency as a small electrical contractor",
];

const SOLAR_TOPICS = [
  "best lead generation strategies for solar companies in 2026",
  "why solar contractors lose leads online and how to fix it",
  "how solar companies can rank on Google without paying for ads",
  "how much do solar leads cost and how to get them cheaper",
  "why do solar companies have high lead costs",
  "what makes homeowners trust a solar company they find online",
  "how long does it take to rank on Google as a local solar company",
  "should solar companies use Google Ads or SEO to get more jobs",
  "what is the best CRM for solar companies",
  "local SEO for solar companies how to rank in your service area",
  "how to get solar installer leads in a new city or service area",
  "Google Business Profile tips for solar companies",
  "how to get 5-star reviews as a solar installer",
  "how solar contractors can dominate local Google search results",
  "AI tools that help solar companies follow up with prospects",
  "how to automate your solar business without hiring more staff",
  "AI receptionist vs human receptionist for solar companies",
  "how solar companies are using AI to book more consultations automatically",
  "Wix vs custom website for solar companies pros and cons",
  "in-house marketing vs hiring an agency for solar companies",
  "DIY website vs professional web design for solar companies",
  "how to choose the best web design agency for solar companies",
  "what to look for in an affordable web design agency for solar contractors",
  "best AI automations every solar company should use in 2026",
  "what does a marketing agency for solar companies actually do",
];

type Vertical = "electrician" | "solar";

const VERTICAL_CONFIG: Record<Vertical, {
  audience: string;
  audienceShort: string;
  category: string;
  servicePath: string;
  linkLabel: string;
}> = {
  electrician: {
    audience: "electrical contractors and electricians",
    audienceShort: "electricians",
    category: "Electricians",
    servicePath: "/services/electrician",
    linkLabel: "web design and AI automation for electricians",
  },
  solar: {
    audience: "solar companies and solar installers",
    audienceShort: "solar companies",
    category: "Solar",
    servicePath: "/services/solar",
    linkLabel: "web design and AI automation for solar companies",
  },
};

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86400000);
}

async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.content) {
    throw new Error(JSON.stringify(data));
  }
  return data.content[0].text.replace(/```json|```/g, "").trim();
}

// When a vertical's curated topic list is exhausted, ask Claude for fresh,
// non-duplicate ideas so the system never falls back to re-publishing an old topic.
async function generateFreshTopics(audience: string, covered: string[]): Promise<string[]> {
  const prompt = `Here are blog topics already covered for ${audience}: ${covered.join("; ")}.

Generate 5 new SEO blog topic ideas covering web design, AI automation, marketing, or lead generation for ${audience} that are not duplicates of the above. Each topic should target a phrase a business owner or homeowner might realistically search for on Google.

Respond ONLY with a valid JSON array of 5 strings, no markdown, no explanation: ["topic 1", "topic 2", "topic 3", "topic 4", "topic 5"]`;

  try {
    const raw = await callClaude(prompt, 1024);
    const ideas = JSON.parse(raw);
    return Array.isArray(ideas) ? ideas.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

async function pingIndexNow(url: string) {
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: "zentra-co.com",
        key: INDEXNOW_KEY,
        keyLocation: `https://zentra-co.com/${INDEXNOW_KEY}.txt`,
        urlList: [url],
      }),
    });
  } catch {
    // Best-effort notification only, never block the post on this
  }
}

Deno.serve(async () => {
  // Fetch existing slugs to avoid duplicate topic generation
  const { data: existingPosts } = await supabase
    .from("blog_posts")
    .select("slug");
  const existingSlugs = new Set((existingPosts || []).map((p: { slug: string }) => p.slug));

  // Alternate verticals daily so electrician and solar coverage stays balanced over time
  const vertical: Vertical = dayOfYear(new Date()) % 2 === 0 ? "electrician" : "solar";
  const config = VERTICAL_CONFIG[vertical];
  const topics = vertical === "electrician" ? ELECTRICIAN_TOPICS : SOLAR_TOPICS;

  // Pick a topic whose slugified form hasn't been published yet
  const shuffled = [...topics].sort(() => Math.random() - 0.5);
  let topic = shuffled.find((t) => !existingSlugs.has(slugify(t)));

  // Curated list exhausted: ask Claude for fresh, non-duplicate ideas for this vertical
  if (!topic) {
    const freshIdeas = await generateFreshTopics(config.audience, topics);
    topic = freshIdeas.find((t) => !existingSlugs.has(slugify(t))) ?? freshIdeas[0] ?? shuffled[0];
  }

  const prompt = `You are an expert SEO content strategist and writer for Zentra Co, a web design and AI automation agency serving ${config.audience} across the United States.

Your sole objective is to write a blog post that ranks on Google, appears in AI Overviews, and drives organic traffic to zentra-co.com. Every decision — structure, wording, FAQ questions — must serve this goal.

Write a fully SEO and AEO optimised blog post on this topic: "${topic}"

This post is written specifically for ${config.audienceShort}. Use "${config.audienceShort}" and related trade-specific language throughout (not generic "contractors"), so the post ranks for ${config.audienceShort}-specific searches. You may reference the other vertical only in passing if genuinely relevant.

CONTENT REQUIREMENTS:
- Length: 1500-2000 words. Longer, more thorough posts consistently outrank thin content.
- Open with a 2-3 sentence direct answer to the topic query — this is what Google's AI Overview and featured snippets pull from. Do not start with a vague intro.
- Use real, specific statistics and data points (at least 4). Make them concrete: percentages, dollar figures, timeframes.
- Write in a confident, direct, conversational tone — like advice from someone who has seen hundreds of ${config.audienceShort} businesses.
- Short paragraphs, 2-3 sentences max.
- NEVER use em dashes (—) anywhere. Use a comma, period, or rewrite the sentence instead. This is a hard rule with no exceptions.
- No buzzwords like "leverage", "seamlessly", "game-changer", or "unlock".

STRUCTURE:
- H1: compelling title with the primary keyword naturally included
- H2/H3 subheadings that mirror how people phrase searches (start with "How", "Why", "What", "Is", etc.)
- Use bullet points and numbered lists where they add clarity — these get pulled into featured snippets
- Include a "Quick Answer" or "Bottom Line" callout box early in the post (wrap in a <div class="callout"> tag)
- FAQ section at the end: 4-6 questions pulled from real "People Also Ask" style queries around this topic. Each answer must be 40-70 words — concise enough to win a featured snippet.

INTERNAL LINKS (required — include naturally in the body copy):
- Link to Zentra Co's ${config.audienceShort} service page: <a href="${config.servicePath}">${config.linkLabel}</a>
- Link to Zentra Co's marketing service: <a href="/services/marketing">marketing for ${config.audienceShort}</a>
- Mention Zentra Co once, naturally, as an example or resource — not a hard sell. Something like "agencies like Zentra Co specialise in ${config.linkLabel}."

CTA:
- End with a short, punchy CTA block (wrap in <div class="cta-block">) directing readers to book a call at zentra-co.com/book-a-call

META:
- Title tag: include the primary keyword, keep under 60 characters
- Meta description: exactly 150-160 characters, include the keyword, end with a clear benefit
- category: must be exactly "${config.category}"

Respond ONLY with a valid JSON object — no markdown, no backticks, no explanation outside the JSON:
{
  "title": "...",
  "slug": "...",
  "meta_description": "...",
  "excerpt": "...(2 sentences, hooks the reader, includes the keyword)...",
  "content": "...(full HTML content using h2, h3, p, ul, ol, div tags)...",
  "category": "${config.category}",
  "tags": ["...", "...", "...", "...", "..."]
}`;

  let raw: string;
  try {
    raw = await callClaude(prompt, 6000);
  } catch (e) {
    return new Response(JSON.stringify({ error: "Claude API error", detail: String(e) }), { status: 500 });
  }

  const post = JSON.parse(raw);

  // Strip any em dashes the model produced despite instructions
  const stripEmDashes = (str: string) => str.replace(/—/g, ',').replace(/\s,/g, ',');
  post.title = stripEmDashes(post.title);
  post.meta_description = stripEmDashes(post.meta_description);
  post.excerpt = stripEmDashes(post.excerpt);
  post.content = stripEmDashes(post.content);

  post.category = config.category;
  post.slug = slugify(post.title);
  post.published_at = new Date().toISOString();

  // Handle slug collision by appending date suffix
  if (existingSlugs.has(post.slug)) {
    post.slug = `${post.slug}-${new Date().toISOString().slice(0, 10)}`;
  }

  const { error } = await supabase.from("blog_posts").insert(post);

  if (error) {
    return new Response(JSON.stringify({ error: error.message, slug: post.slug }), { status: 500 });
  }

  await pingIndexNow(`https://zentra-co.com/blog/post/?slug=${encodeURIComponent(post.slug)}`);

  return new Response(JSON.stringify({ success: true, slug: post.slug, vertical }), { status: 200 });
});
