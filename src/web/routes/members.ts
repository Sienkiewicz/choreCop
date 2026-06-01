import { Router } from 'express';
import Database from 'better-sqlite3';
import type { AuthedRequest } from '../server.js';
import { getAuthContext } from '../auth.js';
import { getAllMembers, addMember, getActiveKids } from '../../db/families.js';
import type { Member } from '../../types.js';

export function membersRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const ctx = getAuthContext(db, (req as AuthedRequest).telegramUserId);
    if (!ctx) { res.status(404).json({ error: 'No family' }); return; }
    res.json(getAllMembers(db, ctx.family.id));
  });

  router.post('/', (req, res) => {
    const ctx = getAuthContext(db, (req as AuthedRequest).telegramUserId);
    if (!ctx) { res.status(404).json({ error: 'No family' }); return; }
    if (ctx.member.role !== 'dad') { res.status(403).json({ error: 'Only dad can add members' }); return; }

    const { name, role } = req.body as { name?: string; role?: Member['role'] };
    if (!name || !role || !['mom', 'kid'].includes(role)) {
      res.status(400).json({ error: 'name and role (mom|kid) are required' });
      return;
    }

    const kidOrder = role === 'kid' ? getActiveKids(db, ctx.family.id).length + 1 : undefined;
    const member = addMember(db, ctx.family.id, name, role, kidOrder);
    res.status(201).json(member);
  });

  router.delete('/:id', (req, res) => {
    const ctx = getAuthContext(db, (req as unknown as AuthedRequest).telegramUserId);
    if (!ctx) { res.status(404).json({ error: 'No family' }); return; }
    if (ctx.member.role !== 'dad') { res.status(403).json({ error: 'Only dad can remove members' }); return; }

    const memberId = parseInt(req.params.id, 10);
    db.prepare('UPDATE members SET active = 0 WHERE id = ? AND family_id = ?').run(memberId, ctx.family.id);
    res.status(204).end();
  });

  return router;
}
