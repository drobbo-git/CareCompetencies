import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, SEED } from './helpers';

describe('auth', () => {
  it('logs in with valid NetID + dev password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: SEED.administrator, password: 'duke24' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.login.systemRole).toBe('Administrator');
  });

  it('rejects a wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: SEED.administrator, password: 'definitely-wrong' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown username', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'not-a-real-netid', password: 'duke24' });
    expect(res.status).toBe(401);
  });

  it('rejects a login request missing the username', async () => {
    const res = await request(app).post('/auth/login').send({ password: 'duke24' });
    expect(res.status).toBe(400);
  });

  it('rejects requests with no Authorization header', async () => {
    const res = await request(app).get('/persons');
    expect(res.status).toBe(401);
  });

  it('rejects requests with a malformed/invalid token', async () => {
    const res = await request(app).get('/persons').set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
  });
});
