import { NextResponse } from 'next/server';
import { readPulseClientLogo } from '@/lib/clients/pulse-store';
import { isStaticClientId } from '@/lib/clients/registry';

export const runtime = 'nodejs';

/**
 * GET /api/clients/{id}/logo — the logo bytes for a brand synced from Pulse.
 *
 * Session-gated by proxy.ts, like everything else under /api that is not /api/auth or
 * /api/v1. It backs an <img> tag, so it cannot use a bearer token — which is the exact
 * constraint that forced Pulse to build us a second logo route on their side rather than
 * reusing their own cookie-gated one. Same shape of problem, opposite direction.
 *
 * ONLY FOR SYNCED BRANDS. A compile-time client's logo is a static file under public/ and is
 * served by Next directly; asking for one here is a 404 rather than a redirect, so a caller
 * cannot quietly end up with two URLs for the same bytes.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isStaticClientId(id)) {
    return NextResponse.json(
      { error: 'This client\'s logo is a static asset. Use /clients/<id>.png.' },
      { status: 404 },
    );
  }

  try {
    const logo = await readPulseClientLogo(id);
    // One 404 for "no such client" and "client with no logo" alike. Unlike Pulse, which
    // keeps the two apart to diagnose a stale blob path, we have nothing to diagnose: the
    // bytes are a column on the row we just read.
    if (!logo) {
      return NextResponse.json({ error: 'No logo for this client' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(logo.buffer), {
      headers: {
        'Content-Type': logo.contentType,
        // Private because this route is session-gated: a shared cache must not hold a
        // response that required a cookie to obtain. Same value and reasoning as Pulse's.
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error(`Logo read failed for client "${id}":`, error);
    return NextResponse.json({ error: 'Could not load logo' }, { status: 500 });
  }
}
