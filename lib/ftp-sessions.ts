import { randomUUID } from 'crypto';
import { FtpConfig } from './ftp';

const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_SESSIONS = 20;

export interface FtpSession {
  id: string;
  config: FtpConfig;
  createdAt: number;
  lastAccessedAt: number;
}

interface SessionStore {
  sessions: Map<string, FtpSession>;
}

const globalSessions = globalThis as typeof globalThis & {
  __localFtpSessions?: SessionStore;
};

const store = globalSessions.__localFtpSessions ?? { sessions: new Map<string, FtpSession>() };
globalSessions.__localFtpSessions = store;

function removeExpiredSessions(now = Date.now()) {
  for (const [id, session] of store.sessions) {
    if (now - session.lastAccessedAt > SESSION_TTL_MS) {
      store.sessions.delete(id);
    }
  }
}

export function createFtpSession(config: FtpConfig): FtpSession {
  removeExpiredSessions();

  if (store.sessions.size >= MAX_SESSIONS) {
    const oldest = [...store.sessions.values()].sort(
      (a, b) => a.lastAccessedAt - b.lastAccessedAt
    )[0];
    if (oldest) store.sessions.delete(oldest.id);
  }

  const now = Date.now();
  const session: FtpSession = {
    id: randomUUID(),
    config: { ...config },
    createdAt: now,
    lastAccessedAt: now,
  };
  store.sessions.set(session.id, session);
  return session;
}

export function getFtpSession(id: string): FtpSession | null {
  removeExpiredSessions();
  const session = store.sessions.get(id);
  if (!session) return null;
  session.lastAccessedAt = Date.now();
  return session;
}

export function deleteFtpSession(id: string): boolean {
  return store.sessions.delete(id);
}
