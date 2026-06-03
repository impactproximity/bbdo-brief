import { NextResponse } from 'next/server';
import { findUserByEmail, verifyPassword, hashPassword } from '@/lib/auth';
import { query } from '@/lib/db';

// No session required: works for logged-in and logged-out users alike.
// Identity is proven by email + current password (there is no email-based reset).
export async function POST(req: Request) {
  try {
    const { email, currentPassword, newPassword } = (await req.json()) as {
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Email, current password and new password are required.' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
    }

    const user = await findUserByEmail(normalizedEmail);
    // Generic message — do not reveal whether the email exists.
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      return NextResponse.json({ error: 'Email or current password is incorrect.' }, { status: 403 });
    }

    if (await verifyPassword(newPassword, user.password_hash)) {
      return NextResponse.json({ error: 'New password must be different from the current one.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await query('UPDATE bbdo_users SET password_hash = @hash WHERE id = @id', {
      hash: passwordHash,
      id: user.id,
    });

    return NextResponse.json({ message: 'Password updated. You can now sign in with your new password.' });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Change-password error:', error);
    return NextResponse.json({ error: 'Could not change password', detail }, { status: 500 });
  }
}
