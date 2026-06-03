import { NextResponse } from 'next/server';
import { hashPassword, findUserByEmail } from '@/lib/auth';
import { query } from '@/lib/db';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };

    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    await query(
      'INSERT INTO bbdo_users (email, password_hash, is_active) VALUES (@email, @hash, 0)',
      { email: normalizedEmail, hash: passwordHash },
    );

    return NextResponse.json(
      { message: 'Account created. An administrator must activate it before you can log in.' },
      { status: 201 },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Signup failed', detail }, { status: 500 });
  }
}
