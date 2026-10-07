import { NextResponse } from 'next/server';
import { findUserByEmail, getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // is_admin is read from the database rather than the session cookie, which carries only
  // { userId, email }. It drives whether the client renders the admin-only Usage link; the
  // real gate is requireAdmin() inside /agency/admin and /api/admin/*. A failure here must
  // not break the page, so it degrades to "not an admin".
  let isAdmin = false;
  try {
    const user = await findUserByEmail(session.email);
    isAdmin = Boolean(user?.is_admin);
  } catch (err) {
    console.warn('[auth/me] could not read is_admin:', err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ email: session.email, isAdmin });
}
