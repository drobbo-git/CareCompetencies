import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAs, SEED } from './helpers';

describe('identity cannot be spoofed via the request body', () => {
  let personToken: string;
  let preceptorToken: string;
  let adminToken: string;

  beforeAll(async () => {
    personToken = await loginAs(SEED.personDn4100);
    preceptorToken = await loginAs(SEED.preceptorDn4100);
    adminToken = await loginAs(SEED.administrator);
  });

  it('attributes an audit event to the real caller, ignoring a forged actor/actorRole', async () => {
    const res = await request(app)
      .post('/audit-events')
      .set('Authorization', `Bearer ${personToken}`)
      .send({ actor: 'FORGED-ADMIN-ID', actorRole: 'Administrator', type: 'Test', summary: 'spoof attempt' });
    expect(res.status).toBe(201);
    expect(res.body.actor).toBe(SEED.personDn4100Id);
    expect(res.body.actorRole).toBe('Person');
  });

  it('attributes a change request to the real caller, ignoring a forged requesterId/requesterRole', async () => {
    const res = await request(app)
      .post('/change-requests')
      .set('Authorization', `Bearer ${personToken}`)
      .send({ requesterId: 'FORGED-ID', requesterRole: 'Administrator', type: 'Add', rationale: 'spoof attempt' });
    expect(res.status).toBe(201);
    expect(res.body.requesterId).toBe(SEED.personDn4100Id);
    expect(res.body.requesterRole).toBe('Person');
  });

  it('records observerId as the real caller even if a different observerId is supplied', async () => {
    const res = await request(app)
      .post('/step-observations')
      .set('Authorization', `Bearer ${preceptorToken}`)
      .send({
        personId: SEED.personDn4100Id,
        stepId: 'vitest-fake-step',
        competencyId: SEED.ms41AchievedCompetencyId,
        observerId: 'SOMEONE-ELSES-ID',
        rating: 'Satisfactory',
      });
    expect(res.status).toBe(201);
    expect(res.body.observerId).toBe(SEED.preceptorDn4100Id);
  });

  it('still lets an Administrator attribute to a specific observerId (bootstrap/import case)', async () => {
    const res = await request(app)
      .post('/step-observations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        personId: SEED.personDn4100Id,
        stepId: 'vitest-fake-step-2',
        competencyId: SEED.ms41AchievedCompetencyId,
        observerId: SEED.preceptorDn4100Id,
        rating: 'Satisfactory',
      });
    expect(res.status).toBe(201);
    expect(res.body.observerId).toBe(SEED.preceptorDn4100Id);
  });
});
