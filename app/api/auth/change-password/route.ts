import { NextResponse } from 'next/server';
import { findUserByEmail, verifyPassword, hashPassword, getSession } from '@/lib/auth';
import { query } from '@/lib/db';

// Session required. Identity is proven by the session cookie alone — the caller no
// longer supplies a current password, so the email MUST come from the session and
// never from the request body (otherwise any signed-in user could target any account).
// Note: /api/auth/* bypasses proxy.ts (ALWAYS_ALLOW), so this check is the only gate.
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'You must be signed in to change your password.' }, { status: 401 });
    }

    const { newPassword } = (await req.json()) as { newPassword?: string };

    if (!newPassword) {
      return NextResponse.json({ error: 'New password is required.' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
    }

    const normalizedEmail = session.email.trim().toLowerCase();
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    if (await verifyPassword(newPassword, user.password_hash)) {
      return NextResponse.json({ error: 'New password must be different from the current one.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await query('UPDATE bbdo_users SET password_hash = @hash WHERE id = @id', {
      hash: passwordHash,
      id: user.id,
    });

    return NextResponse.json({ message: 'Password updated.' });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Change-password error:', error);
    return NextResponse.json({ error: 'Could not change password', detail }, { status: 500 });
  }
}
