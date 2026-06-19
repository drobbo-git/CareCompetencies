import { Router } from 'express';

const router = Router();

const DEFAULT_TIMEOUT_MINUTES = 15;

router.get('/', (_req, res) => {
  const raw = parseInt(process.env.SESSION_TIMEOUT_MINUTES ?? '', 10);
  const sessionTimeoutMinutes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MINUTES;
  res.json({ sessionTimeoutMinutes });
});

export default router;
