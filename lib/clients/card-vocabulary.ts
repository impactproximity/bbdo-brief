/**
 * The closed sets a client card's `icon` and `color` may come from.
 *
 * WHY A CLOSED SET, AND WHY IT CANNOT COME FROM PULSE. `accentMap` in app/agency/page.tsx
 * holds literal Tailwind class strings ('from-blue-700 to-blue-900'). Tailwind scans the
 * source at build time and emits CSS only for classes it finds there, so a colour supplied at
 * runtime — Pulse sends each brand a `selectorBg` hex, e.g. Starbucks #00704A — can never
 * produce a rule. Same for the icons: they are imported lucide components, not names resolved
 * at runtime.
 *
 * Worse, both lookups fall back silently (`|| iconMap.Building2`, `|| accentMap.purple`), so a
 * value outside these sets does not fail — it just renders the wrong card forever. That is why
 * onboarding offers a dropdown rather than a text field, and why the route validates against
 * these arrays rather than trusting its own UI.
 *
 * PLAIN STRINGS, NO JSX, so a server route can import this without pulling in React. The maps
 * in app/agency/page.tsx are typed `Record<ClientIconKey, …>` / `Record<ClientColorKey, …>`
 * against these, so adding a key here without adding the matching map entry fails the build.
 */

export const CLIENT_ICON_KEYS = [
  'Lightbulb',
  'Zap',
  'Share2',
  'Clapperboard',
  'Coffee',
  'Beef',
  'Building2',
  'Repeat',
  'Megaphone',
  'Radio',
  'Ship',
  'Sparkles',
  'Cookie',
  // Added for Etihad. There was no aeroplane in the set, which is why suggestIconKey below
  // mapped airlines to 'Ship' — a ferry icon for a flag carrier.
  'Plane',
] as const;

export const CLIENT_COLOR_KEYS = ['purple', 'orange', 'pink', 'teal', 'yellow', 'red', 'blue', 'navy'] as const;

export type ClientIconKey = (typeof CLIENT_ICON_KEYS)[number];
export type ClientColorKey = (typeof CLIENT_COLOR_KEYS)[number];

export const DEFAULT_CLIENT_ICON: ClientIconKey = 'Building2';
export const DEFAULT_CLIENT_COLOR: ClientColorKey = 'purple';

export function isClientIconKey(value: string): value is ClientIconKey {
  return (CLIENT_ICON_KEYS as readonly string[]).includes(value);
}

export function isClientColorKey(value: string): value is ClientColorKey {
  return (CLIENT_COLOR_KEYS as readonly string[]).includes(value);
}

/**
 * One representative hex per accent key, used only to pick the closest match to a brand's
 * own colour when suggesting a default at onboarding.
 *
 * These are approximations of what each Tailwind gradient reads as, not exact stops — the
 * bar is a two-stop gradient and has no single colour. Good enough for "which of eight is
 * nearest", which is all this is for; the admin can always override the suggestion.
 */
const ACCENT_HEX: Record<ClientColorKey, [number, number, number]> = {
  purple: [147, 51, 234],
  orange: [234, 88, 12],
  pink: [219, 39, 119],
  teal: [13, 148, 136],
  yellow: [234, 179, 8],
  red: [220, 38, 38],
  blue: [37, 99, 235],
  navy: [0, 23, 119],
};

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * The accent key closest to a brand's own hex, or the default when there is no usable hex.
 *
 * Plain squared RGB distance. A perceptual space (CIELAB) would rank better, but this is a
 * pre-filled dropdown value an admin sees and can change in one click — the extra accuracy
 * would not change what they pick.
 */
export function nearestColorKey(hex: string | null | undefined): ClientColorKey {
  const rgb = hex ? parseHex(hex) : null;
  if (!rgb) return DEFAULT_CLIENT_COLOR;

  // White and black carry no hue, so "nearest of eight" returns an arbitrary winner — and
  // white is the single most common value on Pulse (8 of 11 brands have selectorBg #ffffff,
  // i.e. nobody set one). Suggesting yellow for a brand with no colour at all is worse than
  // suggesting the default, which at least reads as "unset".
  const [r, g, b] = rgb;
  const isGreyish = Math.max(r, g, b) - Math.min(r, g, b) < 24;
  if (isGreyish) return DEFAULT_CLIENT_COLOR;

  let best: ClientColorKey = DEFAULT_CLIENT_COLOR;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const key of CLIENT_COLOR_KEYS) {
    const [r, g, b] = ACCENT_HEX[key];
    const d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = key;
    }
  }
  return best;
}

/**
 * A plausible icon for a brand's category, as a starting suggestion.
 *
 * Deliberately crude: there are thirteen icons, none of which is an aeroplane, a bank or a
 * hotel, so most brands land on Building2 and that is the honest answer. The value is in
 * getting Coffee onto a coffee brand, not in pretending this set covers every category.
 */
export function suggestIconKey(category: string | null | undefined): ClientIconKey {
  const c = (category ?? '').toLowerCase();
  if (!c) return DEFAULT_CLIENT_ICON;
  if (/coffee|beverage|drink|cafe/.test(c)) return 'Coffee';
  if (/snack|biscuit|confection|bakery|sweet/.test(c)) return 'Cookie';
  if (/meat|poultry|protein|frozen food/.test(c)) return 'Beef';
  if (/media|entertainment|film|studio|content/.test(c)) return 'Clapperboard';
  if (/telecom|broadcast|radio|audio/.test(c)) return 'Radio';
  if (/advertis|marketing|communicat|media agency/.test(c)) return 'Megaphone';
  if (/ferry|ship|marine|logistic|freight|port/.test(c)) return 'Ship';
  if (/avia|airline|airport|flight/.test(c)) return 'Plane';
  if (/travel|tourism|transport/.test(c)) return 'Plane';
  if (/tech|software|ai|digital|electronic|energy/.test(c)) return 'Zap';
  if (/beauty|luxury|cosmetic|fashion/.test(c)) return 'Sparkles';
  if (/retail|subscription|ecommerce/.test(c)) return 'Repeat';
  return DEFAULT_CLIENT_ICON;
}
