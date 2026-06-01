import type { ClientConfig } from './types';

const proposition = `Strategic positioning: "The original place to be your original self." Starbucks is the original third place — not home, not work, but the place in between where people feel they belong. Originality is feeling safe enough to just be yourself.

Social proposition: "Creating space for originality to show up." Social extends the Starbucks experience beyond the store, making people feel seen in their originality — spotlighting real people, amplifying UGC, and turning rituals into shared community moments.

Primary markets: KSA and UAE (weight them equally).`;

const brandGuidelines = `STARBUCKS — MENA BRAND BRIEF (OKO 2.0)

TENSION → INSIGHT → TRUTH
- Tension: Real human connection is under threat as life moves online faster than people can keep up. In MENA, where culture is built on collectivism, the loss of in-person rituals matters more (112% UAE social penetration vs population; ~14% regional loneliness — among the world's highest; 52% of UAE residents use social as their primary way to keep in touch with family).
- Insight: Originality is feeling safe enough to just be yourself — being yourself around the people who really know you, no overthinking, no adjusting.
- Truth: A third place, crafted for people. Starbucks is the original third place.

BRAND PILLARS (intrinsic)
- Craft — Everything is intentional: the coffee, the atmosphere, the service, the rituals. Care behind every detail.
- Connection — Where real moments happen between baristas and customers, friends, even strangers who arrive alone and leave feeling part of something.
- Belonging — That "this place is yours" feeling that turns a coffee shop into a third place and a customer into a regular.

BRAND PERSONALITY (extrinsic)
- Authentic — We're the original; we don't need to remind anyone.
- Warm — Everything feels human; nothing cold or corporate.
- Confident — Quiet self-assurance; we don't chase trends.
- Inviting — No barriers, no exclusivity; first-timer or regular, you were always meant to be here.

SOCIAL PERSONA — "The Old Friend"
Like an old friend you can always return to — not because they're familiar, but because around them you feel more like yourself. Warm, easy, comfortable; conversations flow; they remember your usual and notice details; they spotlight community without making it a big deal. Not loud, not dramatic.

FIVE SOCIAL TERRITORIES (balance across pillars)
1. Coffee Craft & Rituals (Craft) — coffee expertise, barista tips, beverage-making, origins, "order of the month."
2. People of Starbucks (Connection) — barista stories, partner personalities, community initiatives, barista takeovers, customer moments.
3. Originals in the Community (Connection) — authentic in-store conversations / podcast with community originals.
4. Starbucks in your Day (Belonging) — commutes, drive-thru, delivery, work-from-café, late-night; UGC and proactive listening.
5. The Regulars' World (Belonging) — rewards tips, points moments, secret menu, member perks.

VOICE — FOUR CREATIVE PRINCIPLES (apply ALL FOUR to every piece)
- CRAFTED (curated, concise, passionate) — respect the reader; share passion in relatable language; keep it simple. Don't overexplain, over-romanticize, or get too technical.
- BOLD (declarative, confident, emphatic) — direct, candid, no filler; punchy sentences. Don't brag, don't be overtly competitive, don't be intense for its own sake.
- ENERGIZED (optimistic, lively, rhythmic) — active voice, conversational rhythm, turn the brief into a story. Don't go over the top, don't be a downer, don't go passive.
- WARM (welcoming, real, familiar) — channel a favourite barista; collective language ("we, us, our"); conversational, incomplete sentences are fine. Don't be creepy-familiar, don't use generation-specific slang, don't force sentimentality.

STYLISTIC GUARDRAILS
- Humour: aim for fun, not funny — amplify a good joke, don't tell it. Never silly, edgy, or sarcastic.
- Wordplay: use with caution; puns generally avoided. If you can't imagine a friend saying it, leave it out.
- Emojis: strategic and intentional; don't overload on cute. Exclamation points: sparingly.

PHOTOGRAPHY & CONTENT MOOD
- "Elevated UGC over highly produced advertising imagery." Cinematic, candid, optimistic, human; raw, social-first, imperfect, grainy, cultural, regional, grounded.
- Lighting: warm natural sunlight, soft contrast, warm-brown shadows, gentle saturation. Never overprocessed.

STRENGTHS & WEAKNESSES TO COUNTER
- Strengths: globally recognised icon, much-loved legacy, by people for people.
- Counter these perceptions: "ubiquitous / corporate", "a brand adrift", "manufactured humanity" — favour real partner/customer stories over polished broadcast spots.

SPIRITUAL ANCHOR
"Be yourself, everybody else is already taken." — Oscar Wilde.

CAMPAIGN REFERENCE (register only — DO NOT copy verbatim)
The "Original is..." platform completes an open fragment with small, specific human truths (e.g. "Original is liking your Americano room temperature"; "Original is laughing at the same thing at the same time"). DO NOT generate or recycle "Original is..." copy. Use only to understand the register: small, specific, raw, lived-in — never aspirational or grandiose.`;

const promptGuidance = `WRITE AS STARBUCKS (MENA). Apply these directives to every drafted answer:

1. Write the way a person talks, not the way a deck reads. No buzzwords, no vague superlatives, no corporate phrasing.
2. Apply all four voice principles together: CRAFTED, BOLD, ENERGIZED, WARM.
3. Show — don't tell — that we're the original. Never declare it.
4. Ground ideas in small, specific, lived-in human truths (the "Original is..." register) — never aspirational or grandiose, and never recycle the actual "Original is..." lines.
5. Use collective language ("we, us, our"); conversational, incomplete sentences are fine.
6. Aim for fun, not funny. Lead with relatable everyday stories, not jokes. Never silly, edgy, or sarcastic.
7. Avoid puns, idioms, generation-specific slang, and marketing wordplay. If you can't imagine a friend saying it aloud, leave it out.
8. Exclamation points sparingly; emojis strategically, never to overload cuteness.
9. Cover BOTH KSA and UAE as primary markets, weighted equally.
10. Favour real partner/customer stories and elevated-UGC mood over polished broadcast advertising.

AVOID: politics; religion (beyond cultural moments like Ramadan, handled with care); alcohol; controversy or argumentative claims; competitor put-downs; over-romanticised or overly technical product descriptions; forced sentimentality.`;

export const starbucksConfig: ClientConfig = {
  id: 'starbucks',
  label: 'Starbucks',
  description: 'Briefs for the Starbucks brand — tailored to its proposition and tone of voice.',
  icon: 'Coffee',
  color: 'teal',
  logo: 'clients/starbucks.png',
  logoWidth: 28,
  logoHeight: 28, // square mark (1280×1287)

  proposition,
  brandGuidelines,
  promptGuidance,
};
