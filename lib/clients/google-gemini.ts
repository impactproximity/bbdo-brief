import type { ClientConfig } from './types';

// NOTE ON SOURCES — read before extending this file.
// Three documents were supplied for this client: a blank campaign briefing template, and two
// product information documents. The two information documents are byte-identical (same MD5):
// the file named "Google Gemini Information" is a mis-save of the Google Spark document. So the
// authored content below covers the Gemini Spark PRODUCT proposition and the KSA/Egypt market
// frame, and nothing else. There is deliberately no Google or Gemini brand positioning, tone of
// voice, personality or visual guidance here, because none was supplied — see the DOCUMENTED GAPS
// block in brandGuidelines. Fill those in from the real brand document when it arrives; do not
// infer them.

const proposition = `PRODUCT PROPOSITION — GEMINI SPARK

Google's core value proposition for Gemini Spark is asynchronous, always-on AI agency that operates persistently in the cloud. Spark shifts AI from a reactive, session-based chatbot into a proactive virtual coworker that executes multi-step workflows even when the laptop is closed or the device is turned off.

Reactive versus agentic is the whole argument. Traditional conversational AI needs a direct prompt and stops processing the moment the tab closes. Spark's proposition is persistence and autonomy within secure guardrails: it runs continuously on Google Cloud virtual machines to handle repetitive, multi-app digital tasks.

THE THREE PILLARS — Google structures Spark's workflows around three user-defined elements:
- TASKS — the user defines the objective, for example "find all incoming invoices, log them in a tracking sheet and draft a summary email". Spark breaks that into multi-step actions.
- SKILLS — the user teaches Spark their preferences or style. It can study a sent folder to adapt to the user's writing tone when drafting communications.
- SCHEDULES — the user sets the execution rules. Tasks trigger on a time loop (every Friday at 4pm) or conditionally on an event (whenever mail arrives from a particular sender).

CAPABILITIES AND DIFFERENTIATORS
- Deep Workspace integration — connects natively across Gmail, Calendar, Drive, Docs, Sheets and Maps with zero local setup.
- Web interaction via a cloud browser — when researching external data it spins up a remote browser instance and physically clicks through live pages to extract information, rather than reading flat search snippets.
- Extensible third-party ecosystem — supports the open Model Context Protocol (MCP), interfacing with over 30 external tools including Canva, Adobe, Dropbox, Asana and OpenTable.
- Strict security and guardrails — all data integrations are opt-in by default. For high-stakes actions such as submitting forms, modifying core data, sending email to external contacts or reaching financial checkout fields, Spark pauses, hands back control, or asks for explicit authorisation.

AVAILABILITY AND ACCESS — these are hard qualifiers, never imply otherwise:
- Requires a paid Google AI Pro or Ultra subscription. Spark is excluded from free tiers.
- Accessed via Gemini on the web by clicking "Switch to Spark" in the sidebar, or through the native Gemini mobile and Mac apps.

MARKETS — KSA and Egypt are the briefed markets. Treat them as two distinct markets with different cultural and media codes, not a single "MENA" audience.`;

const brandGuidelines = `GOOGLE GEMINI — MARKET AND BRIEFING FRAME

This client's brand guidance is incomplete by design. What follows is the market, regulatory and
deliverable frame drawn from Google's own campaign briefing template, plus an explicit statement of
what has not been supplied. It is not a substitute for a brand book.

MARKET CONTEXT
- Briefed markets are KSA and Egypt. The two differ in cultural codes, dialect, media behaviour and regulation. Work should be built for a named market, not for an undifferentiated region.
- Language and dialect are a live creative variable, not a translation step. Voiceover and language requirements, local dialect, and local talent and casting are called out as distinct briefing fields.
- Moment-led and seasonal briefs are a recurring pattern: Ramadan, Eid, National Day and White Friday are the named moments.
- Cultural, religious and regulatory sensitivities are a mandatory briefing field for every campaign. So are must-avoid and no-go areas, and competitor context.

HOW WORK ARRIVES
Briefs fall into three origin types, and they are not interchangeable:
- Agency to develop new strategy.
- Strategy provided by the client.
- Adaptation from global. When adapting, the questions that matter are: what global assets exist (films, scripts, key visuals, toolkit, guidelines); what can be adapted versus created locally; whether the global idea is fixed or can be localised and reinterpreted; and which local adaptations are required for language, dialect, talent and cultural fit.

NATURE AND FUNNEL
Briefs are classified as tactical (offer or promotion), brand and purpose-led, product demo and informational, or other — and separately by funnel position: awareness, consideration, conversion, retention and loyalty, or full funnel. A product demo brief for an AI product is a different craft problem from a brand film; do not blur them.

DELIVERABLE CURRENCY
This client briefs in a specific production currency, and work should be scoped in the same terms: master films per market with durations and language or dialect; cutdowns at 6s, 10s, 15s, 20s and 30s with a count per market; resizes across 16:9, 9:16, 1:1 and 4:5; and additional deliverables including behind-the-scenes content, social-first content (reels, stories, short-form), static posts and copy, photography and stills, subtitled and translated versions, and master and project file handover.
Campaign model is either a digital and social-first campaign or a fully integrated 360 campaign. Channels in play span TV and broadcast, digital video (YouTube, CTV, OTT), paid and organic social, OOH and DOOH, cinema, radio and audio, display and HTML banners, retail and in-store, CRM, email and app, influencer and creator, PR, and experiential activation.
Production approaches named: new shoot, animation and motion graphics, CGI, adaptation and re-edit, stock and library, UGC and lo-fi, or hybrid.

PRODUCT INTEGRITY
Gemini and Spark are software with documented and bounded capability. Accuracy about what the product does is a brand issue for this client, not a legal footnote. Describe only the behaviour recorded in the proposition above. The guardrail behaviour — opt-in integrations, pausing before high-stakes actions, handing control back — is part of the proposition and worth showing, not a caveat to bury.

DOCUMENTED GAPS — DO NOT INVENT AROUND THEM
No Google or Gemini brand book, tone-of-voice guide, personality framework, visual identity, logo or colour guidance, audience segmentation, or brand architecture has been supplied. The document named for Gemini brand information is a duplicate of the Spark product document.
Therefore: do not state or imply Google brand tone-of-voice rules, brand values, personality traits or visual mandatories. Do not invent an audience segmentation. Do not assert Gemini masterbrand positioning beyond the Spark product proposition above. Where a brief needs any of this, say plainly that the guidance has not been supplied and ask for it. An honest gap is useful; a plausible invention presented as brand policy is not.`;

const promptGuidance = `WRITE FOR GOOGLE GEMINI. Apply these directives to every drafted answer:

1. Be accurate about the product before being interesting about it. Every capability claim must trace to the supplied Spark proposition. If a benefit sounds good but is not documented, leave it out.
2. Lead with the behavioural shift, not the technology. The story is reactive chatbot to proactive coworker — work that continues when the laptop is closed. Show that, do not announce it.
3. Ground ideas in a real task. Spark is proved by a specific multi-step job done while someone was away from their desk, not by abstract claims about intelligence. Name the task, the apps and the outcome.
4. Use the three pillars as the structure of an explanation when the brief is informational or demo-led: Tasks (the objective), Skills (learning the user's style), Schedules (when it runs).
5. Treat the guardrails as a feature. Opt-in integrations, pausing before sending external mail or reaching checkout, handing control back — for an autonomous agent, trust is the proposition, not fine print.
6. State the market. Write for KSA or for Egypt, with the dialect, cultural code and media behaviour of that market, and say which one the thinking is for. Never write undifferentiated regional work.
7. Name the funnel position and the nature of the brief. Tactical, brand and purpose-led, and product demo briefs each demand a different craft answer. Do not hand back a brand film when the brief is a demo.
8. Be explicit about origin. State whether the thinking is new strategy, client-provided strategy, or a global adaptation — and when adapting, separate what is reused from global from what is created locally.
9. Scope in the client's deliverable currency: master films per market with durations and language, cutdowns by duration, resizes across 16:9, 9:16, 1:1 and 4:5, plus social-first, BTS and subtitled versions where relevant.
10. Respect the access qualifier. Spark requires a paid AI Pro or Ultra subscription and is not in the free tier. Never imply universal or free availability.
11. Where the brief needs brand guidance that has not been supplied — tone of voice, brand values, personality, visual mandatories, audience segmentation — say so and ask for it rather than filling the gap.

AVOID: any product capability, integration, performance figure or availability claim not supported by the supplied material; implying Spark acts without user authorisation on high-stakes actions; competitor put-downs or named comparisons against other AI assistants; fear-based or job-displacement framing; privacy or data-handling claims beyond the documented opt-in and authorisation behaviour; politics; religion and religious practice used as a creative device; cultural stereotyping of either briefed market; and invented Google brand voice, values or design rules.`;

export const googleGeminiConfig: ClientConfig = {
  id: 'google-gemini',
  label: 'Google Gemini',
  description: 'Briefs for Google Gemini — tailored to its product proposition and KSA/Egypt market context.',
  icon: 'Sparkles',
  color: 'blue',

  // Supplied brand logo, converted to PNG with the white background flood-filled from the
  // edges (so interior white artwork survives) and trimmed to the artwork. It must stay
  // .png — the DOCX ImageRun labels every non-jpg as png, so JPEG bytes under a .png name
  // corrupt the header.
  logo: 'clients/google-gemini.png',
  logoWidth: 100,
  logoHeight: 23, // 733x168 aspect (4.363)

  // No `briefTypes` — inherits DEFAULT_AGENCY_BRIEF_TYPE_IDS (the four standard tiers).

  proposition,
  brandGuidelines,
  promptGuidance,
};
