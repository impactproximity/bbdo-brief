import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

// Public pages that never require a session.
const PUBLIC_PAGES = ['/login', '/signup'];

// Next internals, static assets, auth endpoints and metadata icons are never gated.
const ALWAYS_ALLOW = /^\/(?:_next\/|favicon\.ico$|icon$|.*\/icon\.ico$|api\/auth\/)/;
const STATIC_FILE = /\.(?:js|css|map|json|txt|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot)$/;

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Bail early on anything that isn't an app page/API request.
  if (ALWAYS_ALLOW.test(pathname) || STATIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  const isPublicPage = PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPublicPage) {
    // Already signed in → skip login/signup.
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
