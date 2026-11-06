import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';

describe('Auth Module API Tests', () => {
  let authToken = '';

  beforeAll(async () => {
    // Đăng nhập lấy token dùng chung cho các test case
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'operator@smartparking.local',
        password: env.SEED_ADMIN_PASSWORD
      });

    expect(res.status).toBe(200);
    authToken = res.body.data.token;
  });

  it('POST /api/auth/login should return 200 with JWT token and user info', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'operator@smartparking.local',
        password: env.SEED_ADMIN_PASSWORD
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user.email).toBe('operator@smartparking.local');
    expect(res.body.data.user.role).toBe('OPERATOR');
  });

  it('POST /api/auth/login should reject invalid credentials with 400 and AUTH_INVALID_CREDENTIALS', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'operator@smartparking.local',
        password: 'WrongPassword123!'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('GET /api/auth/me should return current user profile when authenticated', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('operator@smartparking.local');
    expect(res.body.data.role).toBe('OPERATOR');
    expect(res.body.data.isActive).toBe(true);
  });

  it('GET /api/auth/me should return 401 when no token is provided', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/auth/me should return 401 when token is malformed', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid_token_value');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });
});

