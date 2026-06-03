import { NextResponse } from 'next/server';
import { findUserByEmail, verifyPassword } from '@/lib/auth';
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session';

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };

    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const user = await findUserByEmail(normalizedEmail);
    // Generic message to avoid leaking whether the email exists.
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Your account is not active yet. Please contact your administrator.' },
        { status: 403 },
      );
    }

    const token = await signSession({ userId: user.id, email: user.email });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed', detail }, { status: 500 });
  }
}
