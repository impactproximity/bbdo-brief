import { NextResponse } from 'next/server';
import { findUserByEmail, stampLastLogin } from '@/lib/auth';
import { isOtpConfigured, verifyLoginCode } from '@/lib/auth/supabaseOtp';
import {
  beginAttempt,
  checkVerifyAllowed,
  hashIp,
  markAttemptSucceeded,
} from '@/lib/auth/otpRateLimit';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Emailed login codes are 6 digits. Break-glass codes from
// admin.generateLink({ type: 'magiclink' }) are 8 — verified against this GoTrue
// instance. A stricter /^\d{6}$/ silently rejects every break-glass code before it
// ever reaches Supabase, i.e. the escape hatch fails exactly when you need it.
// GoTrue still does the real validation; this only rejects obvious junk cheaply.
const CODE_RE = /^\d{6,8}$/;

/**
 * Step 2 of login: exchange a code for a session.
 *
 * This replaces /api/auth/login. The code is verified by Supabase Auth, but the SESSION
 * is still ours: on success we mint the same jose JWT with the integer `bbdo_users.id`,
 * so proxy.ts, /api/auth/me and the briefs routes are all unchanged.
 * We swap the credential, not the authorization layer.
 *
 * There is no separate "check this code" endpoint on purpose — the code is single-use,
 * so anything that checked it before this ran would consume it.
 */

/** One message for every failure mode, so the response cannot be used to tell them apart. */
const GENERIC_FAIL = { error: "That code isn't valid or has expired. Request a new one." };

export async function POST(req: Request) {
  if (!isOtpConfigured()) {
    return NextResponse.json({ error: 'Login is not configured.' }, { status: 503 });
  }

  let body: { email?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const code = (body.code ?? '').trim();

  // Shape-check before any round trip, so malformed input costs nothing.
  if (!EMAIL_RE.test(email) || !CODE_RE.test(code)) {
    return NextResponse.json(GENERIC_FAIL, { status: 401 });
  }

  const ipHash = hashIp(req);

  const verdict = await checkVerifyAllowed(email, ipHash);
  if (!verdict.allowed) {
    // Deliberately the same body as a wrong code — only the status differs, and that is
    // keyed on the caller's own failure count, not on whether the account exists.
    return NextResponse.json(
      { ...GENERIC_FAIL, retryAfter: verdict.retryAfter },
      { status: 429, headers: { 'Retry-After': String(verdict.retryAfter) } },
    );
  }

  // Recorded as failed first. verifyLoginCode swallows its own throws, but a crash
  // anywhere below still leaves the attempt counted against the caller.
  const attemptId = await beginAttempt('verify', email, ipHash);

  try {
    const accepted = await verifyLoginCode(email, code);
    if (!accepted) return NextResponse.json(GENERIC_FAIL, { status: 401 });

    // GoTrue proved they own the mailbox. Our own allowlist decides whether they may in —
    // re-checked here because it could have been revoked since the code was requested.
    const user = await findUserByEmail(email);
    if (!user || !user.is_active) {
      return NextResponse.json(GENERIC_FAIL, { status: 401 });
    }

    // Durable "this person is actually using the tool", for the usage report. Deliberately
    // not awaited — reporting data must never be able to fail a login that just succeeded.
    stampLastLogin(user.id);

    const token = await signSession({ userId: user.id, email: user.email });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    await markAttemptSucceeded(attemptId);
    return res;
  } catch (err) {
    console.error('[auth/verify] failed:', err);
    return NextResponse.json(GENERIC_FAIL, { status: 500 });
  }
}
