/**
 * Starting search profile for entry-level AI / GenAI roles worldwide.
 * Every board below was checked against its public API on 2026-10-20; edit them in Job profile.
 */
export const DEFAULT_ROLE_KEYWORDS = [
  "AI engineer", "GenAI", "generative AI", "LLM", "machine learning", "ML engineer", "applied AI",
  "prompt engineer", "AI solutions", "AI automation", "NLP", "data scientist", "AI developer",
  "AI analyst", "forward deployed", "AI trainer", "conversational AI", "RAG",
];

export const DEFAULT_SKILLS = ["Python", "Prompt engineering", "LLM APIs", "RAG", "TypeScript", "SQL"];

/** Adzuna markets with strong AI hiring and common relocation support. */
export const DEFAULT_COUNTRIES = ["gb", "us", "de", "nl", "ca", "au", "sg", "in"];

export const ADZUNA_COUNTRIES: Record<string, string> = {
  gb: "United Kingdom", us: "United States", de: "Germany", nl: "Netherlands", ca: "Canada",
  au: "Australia", sg: "Singapore", in: "India", fr: "France", es: "Spain", it: "Italy",
  at: "Austria", be: "Belgium", ch: "Switzerland", pl: "Poland", nz: "New Zealand",
  br: "Brazil", mx: "Mexico", za: "South Africa",
};

export const DEFAULT_GREENHOUSE = [
  "anthropic", "scaleai", "databricks", "figma", "stripe", "airbnb", "discord", "gitlab", "cloudflare",
  "samsara", "robinhood", "coinbase", "brex", "datadog", "asana", "reddit", "pinterest", "affirm",
  "instacart", "elastic", "mongodb", "twilio", "duolingo", "dropbox",
];

export const DEFAULT_ASHBY = [
  "openai", "cohere", "perplexity", "elevenlabs", "langchain", "notion", "linear", "ramp", "replit",
  "supabase", "deepgram", "harvey", "writer", "synthesia", "sierra", "decagon", "runway", "poolside",
];

export const DEFAULT_LEVER = ["palantir", "spotify", "shieldai", "zoox"];

/** Search terms for the keyword-based feeds (Remotive, Himalayas, Jobicy). */
export const FEED_TERMS = ["ai", "machine learning", "llm", "generative ai"];
