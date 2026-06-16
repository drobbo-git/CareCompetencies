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
    expect(res.body.length).toBeGreaterThanOrEqual(29);
  });

  it('UnitLeader only sees persons on their own unit', async () => {
    const res = await request(app).get('/persons').set('Authorization', `Bearer ${unitLeaderToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((p: { unitId: string }) => p.unitId === SEED.dn4100UnitId)).toBe(true);
  });

  it('Person only sees themselves', async () => {
    const res = await request(app).get('/persons').set('Authorization', `Bearer ${personToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(SEED.personDn4100Id);
  });
});
