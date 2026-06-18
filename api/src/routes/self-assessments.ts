import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { personScopeFilter, parsePersonScopeOpts, parsePagination } from '../lib/scopeFilter';
import { parseBody } from '../lib/validate';
import crypto from 'crypto';

const router = Router();

const stepSchema = z.object({
  stepId:     z.string().min(1).max(64),
  confidence: z.enum(['HighConfidence', 'LowConfidence', 'NeverDone']),
});

const assessmentSchema = z.object({
  competencyId:  z.string().min(1).max(64),
  overallRating: z.enum(['ReadyForAssessment', 'NeedPractice', 'NeedInstruction']),
  notes:         z.string().max(5000).optional(),
  steps:         z.array(stepSchema).min(1),
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { where, params: scopeParams } = personScopeFilter(req.auth!, 'person_id', parsePersonScopeOpts(req.query));
    const pag = parsePagination(req.query, scopeParams.length + 1);

    const { rows: saRows } = await pool.query(
      `SELECT * FROM self_assessments ${where} ORDER BY submitted_at DESC
       OFFSET ${pag.offsetParam} ROWS FETCH NEXT ${pag.fetchParam} ROWS ONLY`,
      [...scopeParams, pag.params[0], (pag.params[1] as number) + 1],
    );

    const hasMore = saRows.length > pag.pageSize;
    const paged   = saRows.slice(0, pag.pageSize);

    if (paged.length === 0) {
      return res.json({ data: [], page: pag.page, pageSize: pag.pageSize, hasMore: false });
    }

    const assessmentIds = paged.map((r) => r.id as string);
    const placeholders  = assessmentIds.map((_, i) => `$${i + 1}`).join(', ');
    const { rows: stepRows } = await pool.query(
      `SELECT * FROM self_assessment_steps WHERE assessment_id IN (${placeholders})`,
      assessmentIds,
    );

    const stepsByAssessment = new Map<string, typeof stepRows>();
    for (const s of stepRows) {
      const key = s.assessment_id as string;
      if (!stepsByAssessment.has(key)) stepsByAssessment.set(key, []);
      stepsByAssessment.get(key)!.push(s);
    }

    res.json({
      data: paged.map((r) => toAssessment(r, stepsByAssessment.get(r.id as string) ?? [])),
      page: pag.page,
      pageSize: pag.pageSize,
      hasMore,
    });
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { competencyId, overallRating, notes, steps } = parseBody(assessmentSchema, req.body);

    // Self-assessments are for yourself only; Administrators may submit on behalf
    // of a person (e.g. importing historical records).
    if (req.auth!.systemRole !== 'Administrator') {
      const personId = req.body?.personId;
      if (personId && personId !== req.auth!.loginId) {
        res.status(403).json({ error: 'You can only submit self-assessments for yourself.' });
        return;
      }
    }

    const personId     = req.auth!.systemRole === 'Administrator' && req.body?.personId
      ? req.body.personId as string
      : req.auth!.loginId;
    const id           = `sa-${crypto.randomUUID().slice(0, 8)}`;
    const submittedAt  = new Date().toISOString();

    await pool.query(
      `INSERT INTO self_assessments (id, person_id, competency_id, overall_rating, submitted_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, personId, competencyId, overallRating, submittedAt, notes ?? null],
    );

    for (const step of steps) {
      const stepId = `sas-${crypto.randomUUID().slice(0, 8)}`;
      await pool.query(
        `INSERT INTO self_assessment_steps (id, assessment_id, step_id, confidence)
         VALUES ($1, $2, $3, $4)`,
        [stepId, id, step.stepId, step.confidence],
      );
    }

    res.status(201).json({
      id, personId, competencyId, overallRating,
      submittedAt, notes,
      steps: steps.map((s) => ({ stepId: s.stepId, confidence: s.confidence })),
    });
  } catch (err) { next(err); }
});

function toAssessment(r: Record<string, unknown>, stepRows: Record<string, unknown>[]) {
  return {
    id:            r.id,
    personId:      r.person_id,
    competencyId:  r.competency_id,
    overallRating: r.overall_rating,
    submittedAt:   (r.submitted_at as Date).toISOString(),
    notes:         r.notes ?? undefined,
    steps:         stepRows.map((s) => ({ stepId: s.step_id, confidence: s.confidence })),
  };
}

export default router;
