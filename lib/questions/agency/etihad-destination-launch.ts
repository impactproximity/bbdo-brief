import type { AgencyBriefConfig } from './types';

/**
 * Etihad Airways — New Destination Launch Brief.
 *
 * Mapped from the template Etihad's team sent (EY_New Destination.docx), structure intact:
 * Part 1 — The Strategic Framework, then Part 2 — The Practical Checklist.
 *
 * TWO THINGS MAKE THIS UNLIKE EVERY OTHER TIER.
 *
 * 1. The outbound/inbound duality. Every strategic question is asked twice, in two directions:
 *    UAE-to-destination and destination-to-the-world. A route launch has two audiences with
 *    opposite starting assumptions, and collapsing them into one answer is the failure this
 *    structure exists to prevent.
 * 2. The destination mini-guide is WRITTEN BY THE MODEL, not extracted. Their document labels
 *    it "AI-Generated Mini-Guide" in as many words. Those five questions carry
 *    `generated: true`, which exempts them from the "do not fabricate" rule, badges them in the
 *    review screen and prints a verify-before-use caution in the .docx. None of them is
 *    `required` — a thin generation must never block the Generate button.
 *
 * CLIENT-SCOPED. Registered in ./index.ts but deliberately absent from
 * DEFAULT_AGENCY_BRIEF_TYPE_IDS, so it reaches only clients whose briefTypes name it. For a
 * Pulse-synced brand that is `pulse_clients.brief_types`; for a compile-time client it would be
 * ClientConfig.briefTypes, as social-impact-bbdo does.
 *
 * `brief_name` MUST stay at index 0 — app/api/generate-document/route.ts uses questions[0].id
 * as the document H1 and skips it in the body loop, and app/api/v1/briefs/route.ts reads
 * `answers.brief_name` literally when titling an API-raised brief.
 */

const PART_1 = 'Part 1 — The Strategic Framework';
const PART_2 = 'Part 2 — The Practical Checklist';

/**
 * The brand frame comes from Etihad's Beyond Borders strategy: luxury is no longer what you
 * have but how you feel, expressed through three traits — Inviting (guests feel welcomed),
 * Empathetic (calm) and Assured (confident). Kept short on purpose: the brand's own guidelines
 * arrive separately as the always-on client-context block, and repeating them here would just
 * compete with the material a human maintains in Pulse.
 */
const ETIHAD_DESTINATION_SYSTEM_PROMPT = `You are a senior strategist at IMPACT BBDO writing an Etihad Airways new-route launch brief.

WHAT ETIHAD IS
Etihad is the UAE's national airline, rooted in Abu Dhabi. Its strategy goes beyond the border of
physical luxury: the product is not the seat, it is how a guest is made to feel. Three behaviours
carry it — Inviting (inspired by Emirati hospitality, so guests feel welcomed), Empathetic
(designing beyond the physical, so guests feel calm) and Assured (one step ahead, so guests feel
confident). Write as though those are true of the airline, because they are the brief's frame.

WHAT A ROUTE LAUNCH ACTUALLY IS
A new route is two launches, not one, and they rarely share a message:
- OUTBOUND — persuading the UAE market to choose a destination they may barely have considered.
- INBOUND — persuading a new market to choose Etihad for onward travel, against an incumbent
  they already trust.
Where a question names a direction, answer only for that direction. Resist writing one blended
answer that would be true of neither market.

HOW TO WRITE
- Specific over abstract. "Winter-sun seekers who currently default to the Maldives" beats
  "leisure travellers".
- Name the competitive reality plainly — the direct flight, the loyalty programme, the habit
  being disrupted. A route launch brief that will not say what it is up against is not useful.
- The Abu Dhabi stopover and onward connectivity are structural advantages. Treat them as
  reasons to believe, not as decoration.
- Never promise a product feature the materials do not evidence: cabin configurations, frequency
  and aircraft type are facts, not aspirations.
- Keep every answer brief-ready. A creative team should be able to act on it without a meeting.`;

export const etihadDestinationLaunchConfig: AgencyBriefConfig = {
  systemPrompt: ETIHAD_DESTINATION_SYSTEM_PROMPT,
  type: {
    id: 'etihad-destination-launch',
    label: 'New Destination Launch',
    description: 'A new route, briefed in both directions — with an AI-written destination guide.',
    icon: 'Plane',
    color: 'yellow',
  },
  documentTitle: 'New Destination Launch Brief',
  questions: [
    {
      id: 'brief_name',
      title: 'Route / launch name',
      prompt: 'Which route is launching?',
      placeholder: 'e.g., Abu Dhabi – Phnom Penh launch, Summer 2026',
      hint: 'Name the city pair. The team should recognise it at a glance in a channel.',
      required: true,
    },

    // --- 1. The Problem & Opportunity ---
    {
      id: 'outbound_challenge',
      title: 'The outbound challenge (UAE → destination)',
      prompt: 'What is stopping our local market from booking this destination today?',
      placeholder: 'e.g., Almost no awareness of the city beyond a transit stop; loyalty to a competitor’s direct flight; assumed to have no premium hotel stock...',
      hint: 'The specific barrier — awareness, competitor loyalty, perceived lack of premium options, seasonality doubt.',
      section: PART_1,
      required: true,
    },
    {
      id: 'inbound_challenge',
      title: 'The inbound challenge (destination → the world)',
      prompt: 'Why has this market not chosen Etihad before, and what changes that now?',
      placeholder: 'e.g., Defaults to a regional carrier via a competing hub; Abu Dhabi unknown as a connecting point...',
      hint: 'Their current habit and the incumbent being displaced. Be concrete about who that incumbent is.',
      section: PART_1,
      required: true,
    },

    // --- 2. The Audience Mindset ---
    {
      id: 'audience_profiles',
      title: 'Who are they?',
      prompt: 'Define the core traveller profiles for this specific route.',
      placeholder: 'e.g., Winter sun seekers; corporate traders on a new trade corridor; VFR/diaspora travelling to see family...',
      hint: 'Two to four named profiles, each with the reason they fly this route specifically. Not generic segments.',
      section: PART_1,
      required: true,
    },
    {
      id: 'outbound_tension',
      title: 'The outbound tension',
      prompt: 'What does the UAE market currently believe about this destination, and what do we need them to believe?',
      placeholder: 'e.g., From "somewhere you pass through" to "a four-day city break with a food scene worth the flight"...',
      hint: 'A from/to shift in belief, not a list of features.',
      section: PART_1,
      required: true,
    },
    {
      id: 'inbound_tension',
      title: 'The inbound tension',
      prompt: 'What is their current long-haul habit, and how does the Etihad proposition disrupt it?',
      placeholder: 'e.g., Defaults to an overnight connection through a crowded hub; Abu Dhabi offers a calmer, shorter transfer...',
      hint: 'Name the habit, then the specific thing about flying Etihad that breaks it.',
      section: PART_1,
      required: true,
    },

    // --- 3. The Destination Deep Dive — written by the model ---
    // Their document calls this section an "AI-Generated Mini-Guide". These five are the only
    // questions in the app that ask for invented content, which is why each is flagged
    // `generated`, none is `required`, and every one of them is labelled for verification
    // on screen and in the document.
    {
      id: 'destination_geography',
      title: 'Geography & climate',
      prompt: 'AI-written from general knowledge — verify before use. Where the city sits, and what the weather does around the launch window.',
      placeholder: 'Generated for you. Edit freely, or use the chat to push for a different angle.',
      hint: 'Location and region, flight context, seasonality, and what the weather is doing at launch. Seasonal patterns, never a forecast.',
      section: PART_1,
      generated: true,
    },
    {
      id: 'destination_attractions',
      title: 'Top attractions & landmarks',
      prompt: 'AI-written from general knowledge — verify before use. The iconic visual anchors of the city.',
      placeholder: 'Generated for you. Edit freely, or use the chat to push for a different angle.',
      hint: 'Around five long-established landmarks a creative team could actually shoot or illustrate. No "newest" or "best" claims.',
      section: PART_1,
      generated: true,
    },
    {
      id: 'destination_culture',
      title: 'Cultural nuances & vibe',
      prompt: 'AI-written from general knowledge — verify before use. The distinct energy of the city.',
      placeholder: 'Generated for you. Edit freely, or use the chat to push for a different angle.',
      hint: 'Its character and rhythm — historic and traditional, fast-paced tech hub, laid-back coastal — plus any etiquette a campaign should respect.',
      section: PART_1,
      generated: true,
    },
    {
      id: 'destination_experiences',
      title: 'Must-see & do',
      prompt: 'AI-written from general knowledge — verify before use. The experiences that create travel desire.',
      placeholder: 'Generated for you. Edit freely, or use the chat to push for a different angle.',
      hint: 'Experiential activities rather than a sightseeing checklist. What someone comes home talking about.',
      section: PART_1,
      generated: true,
    },
    {
      id: 'destination_cuisine',
      title: 'Cuisine',
      prompt: 'AI-written from general knowledge — verify before use. Signature dishes and dining culture.',
      placeholder: 'Generated for you. Edit freely, or use the chat to push for a different angle.',
      hint: 'Staple dishes and how the city eats. No named restaurants — they close, and the brief outlives them.',
      section: PART_1,
      generated: true,
    },

    // --- 4 & 5. The Etihad Advantage, and the proposition ---
    {
      id: 'etihad_advantage',
      title: 'The Etihad advantage (reasons to believe)',
      prompt: 'What is our undeniable right to win on this route?',
      placeholder: 'e.g., A321LR with First; 4x weekly rising to daily; Abu Dhabi stopover; fastest connection to 50+ Asian cities...',
      hint: 'Aircraft and cabin product, frequency, the Abu Dhabi stopover advantage, and specific onward connectivity. Facts from the materials only.',
      section: PART_1,
      required: true,
    },
    {
      id: 'single_minded_proposition',
      title: 'The single-minded proposition',
      prompt: 'If the audience remembers nothing else about this launch, what is the one thing they must take away?',
      placeholder: 'e.g., The easiest way into a city you have been overlooking.',
      hint: 'One sentence. One idea. If it contains an "and", it is two propositions.',
      section: PART_1,
      required: true,
    },

    // --- Part 2 — the checklist, rendered as the two-column table they drew ---
    {
      id: 'flight_logistics',
      title: 'Flight logistics',
      prompt: 'Inaugural date, frequency, aircraft type and cabin configuration.',
      placeholder: 'e.g., Inaugural 14 June 2026 · 4x weekly · A321LR, First / Business / Economy',
      hint: 'One item per line. Facts from the materials — never inferred.',
      section: PART_2,
      tableRow: true,
      required: true,
    },
    {
      id: 'market_priority',
      title: 'Market priority',
      prompt: 'Primary point of sale, focus outbound routes, and contributing inbound markets.',
      placeholder: 'e.g., Primary POS: UAE · Focus outbound: AUH–PNH · Contributing inbound: KH, VN, TH',
      hint: 'One item per line.',
      section: PART_2,
      tableRow: true,
      required: true,
    },
    {
      id: 'campaign_phasing',
      title: 'Campaign phasing',
      prompt: 'Phase live dates — tease, conversion, inaugural.',
      placeholder: 'e.g., Phase 1 Awareness: 1–20 May · Phase 2 Conversion: 21 May–13 Jun · Phase 3 Inaugural: 14 Jun',
      hint: 'One phase per line, each with its live dates.',
      section: PART_2,
      tableRow: true,
    },
    {
      id: 'deliverables_specs',
      title: 'Deliverables & specs',
      prompt: 'Exact assets required, with format and resolution.',
      placeholder: 'e.g., 1x hero film 30s 16:9 · 3x social 9:16 · 1x print takeover, CMYK 300dpi',
      hint: 'One deliverable per line, with its spec. Counts and ratios, not "a social package".',
      section: PART_2,
      tableRow: true,
      required: true,
    },
    {
      id: 'mandatories_guardrails',
      title: 'Mandatories & guardrails',
      prompt: 'Partner logos, CTA requirements, legal lines and regional restrictions.',
      placeholder: 'e.g., Etihad + tourism board lockup, bottom right · CTA "Book now" to etihad.com · fare disclaimer required in KSA',
      hint: 'One mandatory per line. Hard constraints only — anything a creative team must not get wrong.',
      section: PART_2,
      tableRow: true,
    },
  ],
};
