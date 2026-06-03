import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { query } from './db';
import { SESSION_COOKIE, verifySession, type SessionPayload } from './session';

// Node-only auth helpers (bcrypt + DB). Do NOT import this from middleware.

const BCRYPT_ROUNDS = 12;

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  is_active: boolean; // SQL Server BIT -> boolean
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const rows = await query<UserRow>(
    'SELECT TOP 1 id, email, password_hash, is_active FROM bbdo_users WHERE email = @email',
    { email },
  );
  return rows[0];
}

/** Read and verify the session from the request cookies (server components / route handlers). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
