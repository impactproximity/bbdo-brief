import type { ClientConfig } from './types';

const proposition = `Strategic platform: "Savor Every Day with Sadia." Sadia helps make everyday food moments more enjoyable through dependable taste, ease, and variety — turning routine food moments into satisfying ones. The job is not to make life perfect, but to help people notice and enjoy the good in the moment.

Brand proposition: "Life has no recipe, but Sadia always adds flavor to life." Through all of life's twists and turns, Sadia is there adding flavor, making every moment a little more delicious.

Brand role: Sadia puts in the effort so your good times feel effortless. Brand code: Taste + Convenience + Passion Point = Joy.

Objective: grow brand relevance to a top-3 food brand in the UAE and top-5 in KSA. Primary markets: KSA and UAE (weight them equally).`;

const brandGuidelines = `SADIA — MENA BRAND BRIEF (KSA + UAE)

TENSION → INSIGHT → BRAND ROLE
- Tension: Life's a whirlwind — no recipe, no roadmap, just a constant rush; it's harder than ever to just be in the moment.
- Food insight: Good food engages all the senses, and for a brief moment nothing else matters — texture, smell and taste pull our consciousness into the here and now.
- Human insight: Every meal matters — a moment stolen back from the rush; even the simplest meal is a chance to find joy.
- Brand role: Sadia puts in the effort so your good times feel effortless.
- Brand purpose: every food moment should be a moment of joy; good food enriches the happiness in every moment.

DIFFERENTIATION (white space)
While the category is traditional, heritage-led and heartfelt (story-driven, deep), Sadia brings vibrant, modern energy — fun, effortless and joyful — savoring the moment rather than only honouring the journey. Sadia owns EVERYDAY JOY.

FIVE PRODUCT PILLARS (use to name a product connection)
1. Everyday Food — high-quality basics for traditional cooking; comforting, "where the comfort of home meets comfort food." Sentiment: tastes like home.
2. Helpful Food — innovative ready-to-prepare range that makes everyday cooking effortless; impressive, uncomplicated. Sentiment: I can't believe it only took 10 minutes!
3. Happy Meals — ready-to-eat, fun, flavoured snacks; thrilling, a shot of excitement; own "snackification" and bold flavour. Sentiment: I can't believe it's home cooked!
4. Special Moments — superior, smart-convenient range for occasions that matter; entertaining, prepared with care. Sentiment: the living is easy.
5. Well-Being — wholesome, balanced food for a healthier lifestyle (white meat, lean protein); supportive, "a brand that's got my back." Sentiment: happiness is balance.

SAVORABLE MOMENTS (use to name an occasion connection — most opportunities live here)
- Lunchbox moment — the morning scramble and the small act of care; the after-school "I'm starving."
- BBQ moment — an outdoor ritual that turns a normal day into a mini-occasion; quick prep, marination confidence, shared satisfaction.
- Snacking moment — earned personal downtime (gaming, streaming, studying, late-night scrolling); a private "treat yourself" joy.
- Gatherings / big-meal moments — hosting, family visits, weekend get-togethers; generous, abundant, easy to pull off.
- Food-styling moments ("food porn") — sensory-first content: close-ups, crunch, sizzle, steam, pulls; make "savor" tangible and craveable in-feed.

AUDIENCE
- The Care Givers — mostly mothers / family consumers who value convenience that brings high-quality food to memorable meals; need reassurance food is both healthy and delicious.
- The Go-Getters — 18–25, highly social, want easy-to-make tasty food for a busy life; affordable yet flavorful.
- The Conscious Shoppers — 25+, prioritise health and value, research before buying; want healthy and cost-effective with transparent nutrition info.

VOICE & PERSONALITY
- Warm, real, human, joyful, modern, unpretentious. Celebrate small wins and everyday moments without over-romanticizing.
- Make "savor" specific — tie it to real daily occasions, not abstract lifestyle claims.
- The antidote to boring shelves and kitchens — resilient brightness that livens up the day; uplifting and human with taste-forward appeal.
- Energy is FUN and EFFORTLESS (vs the category's traditional / heartfelt register).

EXPRESSION SYSTEM — YELLOW = EVERYDAY JOY
Sadia's refreshed identity is yellow-led: a bold, ownable cue for optimism, warmth, brightness, energy and happiness. Yellow is a communication rule — use it to cue the moment Sadia makes life feel a little brighter; keep the world real (everyday moments, not fantasy). (White codes everyday-fresh / In Natura; gold codes premium, in smaller proportions.)

HOW THE PLATFORM GROWS
"Savor Every Day" is one core, many expressions — a consistent purpose and tagline adapted to each occasion's truth. Occasions add depth (each a new proof of savoring, not a new strategy) and ladder back to an always-on brand meaning.

REASONS TO BELIEVE / PRINCIPLES
- Trusted quality & reliability; broad range across dayparts and occasions; convenience formats that cut prep without compromising enjoyment; easy to find.
- Build the story so the tagline is the natural conclusion (not just a sign-off); make it specific; keep tone human.

CATEGORY NOTE
Sadia is a halal poultry / protein-led packaged-food brand. Keep food references consistent (no pork; chicken, beef burgers, ready-to-eat / ready-to-cook, snacking). Favour lived, everyday moments over perfect-tabletop fantasy.`;

const promptGuidance = `WRITE AS SADIA (MENA). Apply these directives to every drafted answer:

1. Lead with the platform "Savor Every Day with Sadia" and the proposition "Life has no recipe, but Sadia always adds flavor to life." Brand role: Sadia puts in the effort so your good times feel effortless.
2. Voice: warm, real, human, joyful, modern, unpretentious. Energy is FUN and EFFORTLESS — NOT the category's traditional / heartfelt / story-driven register.
3. Make "savor" specific — tie every idea to a real daily occasion (lunchbox, BBQ, snacking, gatherings, food-styling), not abstract lifestyle claims.
4. Ground opportunities in lived, everyday moments and celebrate small wins. Avoid "perfect-tabletop" food fantasy and over-romanticizing.
5. When you name a brand connection, be specific: cite a product pillar (Everyday Food, Helpful Food, Happy Meals, Special Moments, Well-Being) or a savorable moment.
6. Yellow is Sadia's shortcut to everyday joy — brightness, optimism, warmth. Lean into that energy without over-explaining it.
7. Write the way a person talks, not the way a deck reads. No buzzwords, no vague superlatives, no press-release phrasing.
8. Cover BOTH KSA and UAE as primary markets, weighted equally.
9. Keep all food references halal and on-portfolio (no pork; chicken, beef burgers, ready-to-eat / ready-to-cook, snacking).

AVOID: pork and any non-halal food; alcohol; politics; religion (beyond cultural moments like Ramadan, handled with care); controversy or argumentative claims; competitor put-downs; clinical health/medical/weight-loss claims (Well-Being is about balance, not promises); over-romanticised / perfect-tabletop food fantasy; overly technical product descriptions.`;

export const sadiaConfig: ClientConfig = {
  id: 'sadia',
  label: 'Sadia',
  description: 'Briefs for the Sadia brand — tailored to its proposition and tone of voice.',
  icon: 'Beef',
  color: 'pink',
  logo: 'clients/sadia.png',
  logoWidth: 50,
  logoHeight: 37, // 199×148 aspect

  proposition,
  brandGuidelines,
  promptGuidance,
};
