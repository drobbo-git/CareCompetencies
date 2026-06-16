import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, loginAs, SEED } from './helpers';

describe('authorization gates (added after the security audit)', () => {
  let adminToken: string;
  let unitLeaderToken: string;
  let preceptorToken: string;
  let personToken: string;

  // Competencies have no DELETE route — leftover rows are harmless on a
  // throwaway local test DB, but named distinctly (vitest-created-*) so
  // they're obviously test fixtures if anyone looks.
  const createdAssignmentIds: string[] = [];

  beforeAll(async () => {
    adminToken = await loginAs(SEED.administrator);
    unitLeaderToken = await loginAs(SEED.unitLeaderDn4100);
    preceptorToken = await loginAs(SEED.preceptorDn4100);
    personToken = await loginAs(SEED.personDn4100);
  });

  afterAll(async () => {
    for (const id of createdAssignmentIds) {
      await request(app).delete(`/competency-assignments/${id}`).set('Authorization', `Bearer ${adminToken}`);
    }
  });

  describe('persons.ts PATCH /:id (preceptor reassignment)', () => {
    it('blocks a Person from reassigning anyone\'s preceptor', async () => {
      const res = await request(app)
        .patch(`/persons/${SEED.personOnOtherUnitId}`)
        .set('Authorization', `Bearer ${personToken}`)
        .send({ primaryPreceptorId: null });
      expect(res.status).toBe(403);
    });

    it('allows a UnitLeader to reassign a preceptor for a person on their own unit', async () => {
      const res = await request(app)
        .patch(`/persons/${SEED.personDn4100Id}`)
        .set('Authorization', `Bearer ${unitLeaderToken}`)
        .send({ primaryPreceptorId: SEED.preceptorDn4100Id });
      expect(res.status).toBe(200);
      expect(res.body.primaryPreceptorId).toBe(SEED.preceptorDn4100Id);
    });

    it('blocks a UnitLeader from touching a person on a different unit', async () => {
      const res = await request(app)
        .patch(`/persons/${SEED.personOnOtherUnitId}`)
        .set('Authorization', `Bearer ${unitLeaderToken}`)
        .send({ primaryPreceptorId: null });
      expect(res.status).toBe(403);
    });
  });

  describe('competencies.ts catalog mutations', () => {
    it('blocks a Preceptor from creating a competency', async () => {
      const res = await request(app)
        .post('/competencies')
        .set('Authorization', `Bearer ${preceptorToken}`)
        .send({ name: 'Should Not Be Created', unitIds: [] });
      expect(res.status).toBe(403);
    });

    it('blocks a Person from deleting a competency group', async () => {
      const res = await request(app)
        .delete('/competencies/groups/some-group-id')
        .set('Authorization', `Bearer ${personToken}`);
      expect(res.status).toBe(403);
    });

    it('allows an Administrator to create a competency', async () => {
      const res = await request(app)
        .post('/competencies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'vitest-created-competency', unitIds: [] });
      expect(res.status).toBe(201);
    });

    it('still allows any authenticated role to read the catalog', async () => {
      const res = await request(app).get('/competencies').set('Authorization', `Bearer ${personToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('competency-assignments POST/DELETE', () => {
    it('blocks a Preceptor from creating an assignment', async () => {
      const res = await request(app)
        .post('/competency-assignments')
        .set('Authorization', `Bearer ${preceptorToken}`)
        .send({ competencyId: SEED.anyCompetencyId, unitId: SEED.dn4100UnitId, roleId: 'r-rn', stage: 'Core' });
      expect(res.status).toBe(403);
    });

    it('allows a UnitLeader to create an assignment on their own unit', async () => {
      const res = await request(app)
        .post('/competency-assignments')
        .set('Authorization', `Bearer ${unitLeaderToken}`)
        .send({ competencyId: SEED.anyCompetencyId, unitId: SEED.dn4100UnitId, roleId: 'r-rn', stage: 'Core' });
      expect(res.status).toBe(201);
      createdAssignmentIds.push(res.body.id);
    });

    it('blocks a UnitLeader from creating an assignment on a different unit', async () => {
      const res = await request(app)
        .post('/competency-assignments')
        .set('Authorization', `Bearer ${unitLeaderToken}`)
        .send({ competencyId: SEED.anyCompetencyId, unitId: SEED.otherUnitId, roleId: 'r-rn', stage: 'Core' });
      expect(res.status).toBe(403);
    });
  });
});
