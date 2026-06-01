import crypto from 'crypto';
import Database from 'better-sqlite3';
import type { Family, Member } from '../types.js';
import { findFamilyByMemberTelegramId } from '../db/families.js';

export interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

export function validateInitData(initData: string, botToken: string): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (hash !== expected) return null;

  const userStr = params.get('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr) as TelegramUser;
  } catch {
    return null;
  }
}

export interface AuthContext {
  family: Family;
  member: Member;
}

export function getAuthContext(db: Database.Database, telegramId: number): AuthContext | null {
  return findFamilyByMemberTelegramId(db, telegramId);
}
