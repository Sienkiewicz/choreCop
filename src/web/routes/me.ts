import { Router } from 'express';
import Database from 'better-sqlite3';
import type { AuthedRequest } from '../server.js';
import { getAuthContext } from '../auth.js';

export function meRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const ctx = getAuthContext(db, (req as AuthedRequest).telegramUserId);
    if (!ctx) {
      res.json({ family: null, member: null });
      return;
    }
    res.json({ family: ctx.family, member: ctx.member });
  });

  return router;
}
