/**
 * What a client looks like to the browser.
 *
 * The wire shape of GET /api/clients, kept here rather than in the route so a client
 * component can import the type without importing a route module. Card fields only — if you
 * find yourself adding `proposition` or `brandGuidelines`, the thing that needs them is
 * running in the browser and should not be.
 */
export interface ClientCard {
  id: string;
  label: string;
  description: string;
  /** Key into the iconMap in app/agency/page.tsx. Used only when logoSrc is null. */
  icon: string;
  /** Key into the accentMap in app/agency/page.tsx. */
  color: string;
  /**
   * A ready-to-use src, or null for the icon fallback. Resolved server-side so the page does
   * not branch on where the bytes live: a file under public/ for a compile-time client, one
   * of our own routes for a brand synced from Pulse.
   */
  logoSrc: string | null;
  /**
   * The tier ids this client may raise, ALWAYS explicit — the default four are expanded
   * rather than sent as null, so the browser needs no knowledge of that default.
   */
  briefTypes: string[];
  source: 'static' | 'pulse';
}
