import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAs, SEED } from './helpers';

describe('request validation (zod)', () => {
  let unitLeaderToken: string;
  let adminToken: string;

  beforeAll(async () => {
    unitLeaderToken = await loginAs(SEED.unitLeaderDn4100);
    adminToken = await loginAs(SEED.administrator);
  });

  it('rejects an invalid rating enum with a clean 400, not a raw SQL error', async () => {
    const res = await request(app)
      .post('/step-observations')
      .set('Authorization', `Bearer ${unitLeaderToken}`)
      .send({ personId: 'x', stepId: 'y', competencyId: 'z', rating: 'NOT_A_REAL_RATING' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
    expect(res.body.details[0].path).toBe('rating');
  });

  it('rejects a competency-assignment missing required fields', async () => {
    const res = await request(app)
      .post('/competency-assignments')
      .set('Authorization', `Bearer ${unitLeaderToken}`)
      .send({ unitId: SEED.dn4100UnitId });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid stage enum on a competency-assignment', async () => {
    const res = await request(app)
      .post('/competency-assignments')
      .set('Authorization', `Bearer ${unitLeaderToken}`)
      .send({ competencyId: SEED.anyCompetencyId, unitId: SEED.dn4100UnitId, roleId: 'r-rn', stage: 'NotAStage' });
    expect(res.status).toBe(400);
  });

  it('rejects a bulk-import CSV missing required columns', async () => {
    const res = await request(app)
      .post('/imports/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ filename: 'bad.csv', content: 'Name,Unit\nJordan Lee,DN 4100 General Medicine\n' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required column/i);
  });

  it('rejects a bulk-import row with a malformed StartDate', async () => {
    const res = await request(app)
      .post('/imports/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        filename: 'bad-date.csv',
        content: 'NetID,Name,Unit,StartDate\nvitest1,Vitest Person,DN 4100 General Medicine,13/45/2026\n',
      });
    expect(res.status).toBe(202);
    // Bad rows fail individually rather than rejecting the whole job —
    // poll for completion and check the row-level error.
    let job = res.body;
    for (let i = 0; i < 20 && job.status === 'Processing'; i++) {
      await new Promise((r) => setTimeout(r, 300));
      const poll = await request(app).get(`/imports/${job.id}`).set('Authorization', `Bearer ${adminToken}`);
      job = poll.body;
    }
    expect(job.status).toBe('Completed');
    expect(job.errorCount).toBe(1);
    expect(job.rowResults[0].error).toMatch(/StartDate/);
  });
});
