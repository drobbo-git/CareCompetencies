import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import referenceRouter from './routes/reference';
import personsRouter from './routes/persons';
import competenciesRouter from './routes/competencies';
import assignmentsRouter from './routes/assignments';
import observationsRouter from './routes/observations';
import achievementsRouter from './routes/achievements';
import changeRequestsRouter from './routes/change-requests';
import auditRouter from './routes/audit';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: process.env.FRONTEND_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/auth', authRouter);
  app.use('/', referenceRouter);              // /units, /person-roles, /preceptors, /administrators
  app.use('/persons', personsRouter);
  app.use('/competencies', competenciesRouter); // /competencies, /competencies/groups, /competencies/steps, /competencies/:id/steps
  app.use('/competency-assignments', assignmentsRouter);
  app.use('/step-observations', observationsRouter);
  app.use('/competency-achievements', achievementsRouter);
  app.use('/change-requests', changeRequestsRouter);
  app.use('/audit-events', auditRouter);

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  });

  return app;
}
