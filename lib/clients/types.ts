export interface ClientConfig {
  // --- Dashboard card fields (mirror BriefType so colorMap/iconMap reuse works) ---
  id: string; // url-safe, used in ?client=<id> e.g. 'starbucks'
  label: string; // 'Starbucks'
  description: string; // short line under the card
  icon: string; // key into dashboard iconMap (lucide name)
  color: string; // 'purple' | 'orange' | 'pink' | 'teal'

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
