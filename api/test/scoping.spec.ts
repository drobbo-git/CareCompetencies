import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAs, SEED } from './helpers';

describe('role-based data scoping', () => {
  let adminToken: string;
  let unitLeaderToken: string;
  let personToken: string;

  beforeAll(async () => {
    adminToken = await loginAs(SEED.administrator);
    unitLeaderToken = await loginAs(SEED.unitLeaderDn4100);
    personToken = await loginAs(SEED.personDn4100);
  });

  it('Administrator sees all persons', async () => {
    const res = await request(app).get('/persons').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(29);
    expect(typeof res.body.total).toBe('number');
  });

  it('UnitLeader only sees persons on their own unit', async () => {
    const res = await request(app).get('/persons').set('Authorization', `Bearer ${unitLeaderToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((p: { unitId: string }) => p.unitId === SEED.dn4100UnitId)).toBe(true);
  });

  it('Person only sees themselves', async () => {
    const res = await request(app).get('/persons').set('Authorization', `Bearer ${personToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(SEED.personDn4100Id);
  });
});

describe('Preceptor achievement/observation scoping (the load-test fix)', () => {
  let preceptorToken: string;
  let adminToken: string;

  beforeAll(async () => {
    preceptorToken = await loginAs(SEED.preceptorDn4100);
    adminToken = await loginAs(SEED.administrator);

    // Make sure the preceptor has signed off at least one OTHER person, so
    // "default returns only my own rows" is actually a meaningful assertion
    // (not just true because no other rows exist).
    await request(app)
      .post('/competency-achievements')
      .set('Authorization', `Bearer ${preceptorToken}`)
      .send({ personId: SEED.personDn4100Id, competencyId: SEED.ms41AchievedCompetencyId, achievedAt: new Date().toISOString() });
  });

  it('defaults to the preceptor\'s own rows only — not the whole table', async () => {
    const res = await request(app).get('/competency-achievements').set('Authorization', `Bearer ${preceptorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((a: { personId: string }) => a.personId === SEED.preceptorDn4100Id)).toBe(true);
  });

  it('lets a preceptor explicitly request a specific learner\'s achievements via personId', async () => {
    const res = await request(app)
      .get(`/competency-achievements?personId=${SEED.personDn4100Id}`)
      .set('Authorization', `Bearer ${preceptorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((a: { personId: string }) => a.personId === SEED.personDn4100Id)).toBe(true);
  });

  it('lets a preceptor request multiple learners via personIds', async () => {
    const res = await request(app)
      .get(`/competency-achievements?personIds=${SEED.personDn4100Id},${SEED.preceptorDn4100Id}`)
      .set('Authorization', `Bearer ${preceptorToken}`);
    expect(res.status).toBe(200);
    const personIds = new Set(res.body.data.map((a: { personId: string }) => a.personId));
    expect(personIds.has(SEED.personDn4100Id)).toBe(true);
    expect(personIds.has(SEED.preceptorDn4100Id)).toBe(true);
  });

  it('Administrator default query is unscoped — sees achievements from multiple persons', async () => {
    const res = await request(app)
      .get('/competency-achievements?pageSize=2000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBeGreaterThan(0);
    // Unscoped: results span more than one person
    const personIds = new Set(res.body.data.map((a: { personId: string }) => a.personId));
    expect(personIds.size).toBeGreaterThan(1);
  });
});
