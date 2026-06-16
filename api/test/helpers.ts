import request from 'supertest';
import { createApp } from '../src/app';

export const app = createApp();

export async function loginAs(username: string): Promise<string> {
  const res = await request(app)
    .post('/auth/login')
    .send({ username, password: process.env.DEV_PASSWORD ?? 'duke24' });
  if (res.status !== 200) {
    throw new Error(`login failed for ${username}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

// Known seed-data accounts (api/etl/data/carecompetencies_seed.json), one per role.
export const SEED = {
  administrator: 'wr12',
  unitLeaderDn4100: 'wv38',
  preceptorDn4100: 'ms41',
  preceptorDn4100Id: '2f4a6c8e-0b1d-4e3f-a789-512345678001',
  personDn4100: 'sh27',
  personDn4100Id: '3a5b7c9d-1e2f-4a0b-b890-512345678002',
  // u-dn4100 vs u-2b2c — used for cross-unit authorization checks.
  personOnOtherUnitId: '0b2c4d6e-8f9a-4b7c-c567-512345678009',
  dn4100UnitId: 'u-dn4100',
  otherUnitId: 'u-2b2c',
  // A competency ms41 (preceptorDn4100) has already achieved.
  ms41AchievedCompetencyId: 'c-bpa-transfusion',
  anyCompetencyId: 'c-airway-adv',
};
