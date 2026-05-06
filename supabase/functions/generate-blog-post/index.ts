import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const TOPICS = [
  // High commercial intent
  "how much does a website cost for an electrician",
  "best lead generation strategies for solar companies in 2025",
  "how to get more customers as an electrical contractor",
  "why solar contractors lose leads online and how to fix it",
  "how to get electrical contracting jobs without referrals",
  "what does a good electrician website need to convert visitors",
  "how solar companies can rank on Google without paying for ads",
  "how much do solar leads cost and how to get them cheaper",
  // Question / People Also Ask style
  "what questions should I ask before hiring an electrician",
  "how do homeowners find electricians near them",
  "why do solar companies have high lead costs",
  "what makes homeowners trust a solar company they find online",
  "how long does it take to rank on Google as a local contractor",
  "should electricians use Google Ads or SEO to get more jobs",
  "what is the best CRM for electrical contractors",
  // Long-tail local SEO
  "local SEO for electricians how to rank in your city",
  "how to get electrician leads in a new city or service area",
  "Google Business Profile tips for electrical and solar contractors",
  "how to get 5-star reviews as an electrician or solar installer",
  "how solar contractors can dominate local Google search results",
  // AI and automation angle
  "how AI can help electricians respond to leads faster",
  "AI tools that help solar companies follow up with prospects",
  "how to automate your electrical business without hiring more staff",
  "AI receptionist vs human receptionist for contractor businesses",
  "how electricians are using AI to book more jobs automatically",
  // Comparison and decision content
  "electrician website builder vs custom web design which is better",
  "Wix vs custom website for solar companies pros and cons",
  "paid ads vs SEO for electrical contractors which gets more leads",
  "in-house marketing vs agency for solar and electrical contractors",
  "DIY website vs professional web design for electricians",
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

Deno.serve(async () => {
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];

  const prompt = `You are an expert SEO content strategist and writer for Zentra Co, a web design and AI automation agency serving electrical and solar contractors across the United States.

Your sole objective is to write a blog post that ranks on Google, appears in AI Overviews, and drives organic traffic to zentra-co.com. Every decision — structure, wording, FAQ questions — must serve this goal.

Write a fully SEO and AEO optimised blog post on this topic: "${topic}"

CONTENT REQUIREMENTS:
- Length: 1500-2000 words. Longer, more thorough posts consistently outrank thin content.
- Open with a 2-3 sentence direct answer to the topic query — this is what Google's AI Overview and featured snippets pull from. Do not start with a vague intro.
- Use real, specific statistics and data points (at least 4). Make them concrete: percentages, dollar figures, timeframes.
- Write in a confident, direct, conversational tone — like advice from someone who has seen hundreds of contractor businesses.
- Short paragraphs, 2-3 sentences max.
- No em dashes, no buzzwords like "leverage", "seamlessly", "game-changer", or "unlock".

STRUCTURE:
- H1: compelling title with the primary keyword naturally included
- H2/H3 subheadings that mirror how people phrase searches (start with "How", "Why", "What", "Is", etc.)
- Use bullet points and numbered lists where they add clarity — these get pulled into featured snippets
- Include a "Quick Answer" or "Bottom Line" callout box early in the post (wrap in a <div class="callout"> tag)
- FAQ section at the end: 4-6 questions pulled from real "People Also Ask" style queries around this topic. Each answer must be 40-70 words — concise enough to win a featured snippet.

INTERNAL LINKS (required — include naturally in the body copy):
- Link to Zentra Co's growth systems service: <a href="/services/growth-systems">growth systems for contractors</a>
- Link to Zentra Co's marketing service: <a href="/services/marketing">contractor marketing</a>
- Mention Zentra Co once, naturally, as an example or resource — not a hard sell. Something like "agencies like Zentra Co specialise in this for electrical and solar businesses."

CTA:
- End with a short, punchy CTA block (wrap in <div class="cta-block">) directing readers to book a call at zentra-co.com/book-a-call

META:
- Title tag: include the primary keyword, keep under 60 characters
- Meta description: exactly 150-160 characters, include the keyword, end with a clear benefit

Respond ONLY with a valid JSON object — no markdown, no backticks, no explanation outside the JSON:
{
  "title": "...",
  "slug": "...",
  "meta_description": "...",
  "excerpt": "...(2 sentences, hooks the reader, includes the keyword)...",
  "content": "...(full HTML content using h2, h3, p, ul, ol, div tags)...",
  "category": "...",
  "tags": ["...", "...", "...", "...", "..."]
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.content) {
    return new Response(JSON.stringify({ error: "Claude API error", detail: data }), { status: 500 });
  }

  const raw = data.content[0].text.replace(/```json|```/g, "").trim();
  const post = JSON.parse(raw);

  post.slug = slugify(post.title);

  const { error } = await supabase.from("blog_posts").insert(post);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, slug: post.slug }), { status: 200 });
});
