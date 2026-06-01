import { Router } from 'express';
import Database from 'better-sqlite3';
import type { AuthedRequest } from '../server.js';
import { getAuthContext } from '../auth.js';
import { upsertFamily, addMember, linkMember } from '../../db/families.js';

export function familyRouter(db: Database.Database): Router {
  const router = Router();

  router.post('/', (req, res) => {
    const telegramUserId = (req as AuthedRequest).telegramUserId;
    const existing = getAuthContext(db, telegramUserId);
    if (existing) {
      res.status(409).json({ error: 'Already in a family' });
      return;
    }

    const { name, chat_id } = req.body as { name?: string; chat_id?: number };
    if (!name || !chat_id) {
      res.status(400).json({ error: 'name and chat_id are required' });
      return;
    }

    const family = upsertFamily(db, chat_id, name);
    const member = addMember(db, family.id, req.body.first_name ?? 'Тато', 'dad');
    linkMember(db, member.id, telegramUserId);

    res.status(201).json({ family, member });
  });

  return router;
}
