import express, { Request, Response, NextFunction } from 'express';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import Database from 'better-sqlite3';
import { validateInitData, getAuthContext } from './auth.js';
import { meRouter } from './routes/me.js';
import { familyRouter } from './routes/family.js';
import { membersRouter } from './routes/members.js';
import { rulesRouter } from './routes/rules.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AuthedRequest extends Request {
  telegramUserId: number;
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const initData = req.headers['x-telegram-init-data'] as string | undefined;
  const botToken = process.env.BOT_TOKEN ?? '';
  const user = initData ? validateInitData(initData, botToken) : null;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  (req as AuthedRequest).telegramUserId = user.id;
  next();
}

export function startWebServer(db: Database.Database, port: number): void {
  const app = express();
  app.use(express.json());
  app.use(express.static(join(__dirname, 'public')));

  app.use('/api/me', authMiddleware, meRouter(db));
  app.use('/api/family', authMiddleware, familyRouter(db));
  app.use('/api/members', authMiddleware, membersRouter(db));
  app.use('/api/rules', authMiddleware, rulesRouter(db));

  app.listen(port, () => console.log(`[web] Mini App server on :${port}`));
}
