export interface ClientConfig {
  // --- Dashboard card fields (mirror BriefType so colorMap/iconMap reuse works) ---
  id: string; // url-safe, used in ?client=<id> e.g. 'starbucks'
  label: string; // 'Starbucks'
  description: string; // short line under the card
  icon: string; // key into dashboard iconMap (lucide name)
  color: string; // 'purple' | 'orange' | 'pink' | 'teal'

  /**
   * Optional allow-list of agency brief-type ids this client may raise, in display order.
   * Omit it and the client gets DEFAULT_AGENCY_BRIEF_TYPE_IDS (the four standard tiers).
   * Deliberately `string[]` rather than the tier-id union: importing that union from
   * lib/questions/agency would invert the dependency edge between the two modules.
   */
  briefTypes?: string[];

  /**
   * Extra names the public API will accept for this client, beyond the id and the label.
   *
   * Consuming platforms identify brands by their own display names — Impact BBDO Pulse
   * sends "P&O", not "p-and-o". Normalising id and label covers most of them (e.g.
   * "McVitie's" reduces to "mcvities", which is already the id), but not where the other
   * platform's name is a strict subset of ours. Add the exact foreign spelling here rather
   * than loosening the matcher to prefixes, which would make "P" resolve to P&O Ferries.
   *
   * Matching is case- and punctuation-insensitive, so one entry covers "P&O", "p&o" and "P & O".
   */
  aliases?: string[];

  // --- Branding asset for the .docx header (and optionally the dashboard card) ---
  logo?: string; // path under public/, e.g. 'clients/starbucks.png'. When absent, header falls back to a name TextRun.
  logoWidth?: number; // optional ImageRun width  (default ~100)
  logoHeight?: number; // optional ImageRun height (default ~26)

  // --- Always-on, prompt-cached strategic context (authored from client docs) ---
  // Any field left as an empty string is simply omitted from the injected context,
  // so a placeholder config produces zero change to AI behaviour until content lands.
  proposition: string;
  brandGuidelines: string;
  promptGuidance: string; // the per-client prompt doc, applied across all 4 brief categories
}
