import { Router } from 'express';
import Database from 'better-sqlite3';
import type { AuthedRequest } from '../server.js';
import { getAuthContext } from '../auth.js';
import { getActiveRules, createRule, setFixedAssignments } from '../../db/rules.js';
import type { WorkRule } from '../../types.js';

export function rulesRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const ctx = getAuthContext(db, (req as AuthedRequest).telegramUserId);
    if (!ctx) { res.status(404).json({ error: 'No family' }); return; }
    res.json(getActiveRules(db, ctx.family.id));
  });

  router.post('/', (req, res) => {
    const ctx = getAuthContext(db, (req as AuthedRequest).telegramUserId);
    if (!ctx) { res.status(404).json({ error: 'No family' }); return; }
    if (ctx.member.role !== 'dad' && ctx.member.role !== 'mom') {
      res.status(403).json({ error: 'Only parents can manage rules' });
      return;
    }

    const { name, schedule, workers_count, rotation_mode, fixed_member_ids } = req.body as {
      name?: string;
      schedule?: string;
      workers_count?: number;
      rotation_mode?: WorkRule['rotation_mode'];
      fixed_member_ids?: number[];
    };

    if (!name || !schedule || !workers_count || !rotation_mode) {
      res.status(400).json({ error: 'name, schedule, workers_count, rotation_mode are required' });
      return;
    }

    const rule = createRule(db, ctx.family.id, name, schedule, workers_count, rotation_mode);
    if (rotation_mode === 'fixed' && fixed_member_ids?.length) {
      setFixedAssignments(db, rule.id, fixed_member_ids);
    }

    res.status(201).json(rule);
  });

  router.delete('/:id', (req, res) => {
    const ctx = getAuthContext(db, (req as unknown as AuthedRequest).telegramUserId);
    if (!ctx) { res.status(404).json({ error: 'No family' }); return; }
    if (ctx.member.role !== 'dad' && ctx.member.role !== 'mom') {
      res.status(403).json({ error: 'Only parents can manage rules' });
      return;
    }

    const ruleId = parseInt(req.params.id, 10);
    db.prepare('UPDATE work_rules SET active = 0 WHERE id = ? AND family_id = ?').run(ruleId, ctx.family.id);
    res.status(204).end();
  });

  return router;
}
