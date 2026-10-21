import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

// Public pages for logged-out users (redirected to /agency if already signed in).
const PUBLIC_PAGES = ['/login'];
// Pages reachable in BOTH states (no redirect either way).
const OPEN_PAGES: string[] = [];

// Next internals, static assets, auth endpoints and metadata icons are never gated.
//
// `api/v1/` is the public machine API. It is exempt from the SESSION gate only — it is not
// unauthenticated. Its callers hold an API key, which has to be verified against the
// database, and this file runs on the edge with no database access (see lib/session). So
// the check lives in-route in Node (lib/api/auth.ts requireApiKey), exactly as the admin
// role check does for the same reason.
const ALWAYS_ALLOW = /^\/(?:_next\/|favicon\.ico$|icon$|.*\/icon\.ico$|api\/auth\/|api\/v1\/)/;
const STATIC_FILE = /\.(?:js|css|map|json|txt|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot)$/;

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Bail early on anything that isn't an app page/API request.
  if (ALWAYS_ALLOW.test(pathname) || STATIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  // Open pages are reachable whether signed in or not.
  if (OPEN_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  const isPublicPage = PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPublicPage) {
    // Already signed in → skip login.
    if (session) return NextResponse.redirect(new URL('/agency', req.url));
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const proxyConfig = {
  // Run on everything except Next internals and static asset files (incl. logos / *.ico).
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)'],
};
