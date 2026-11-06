import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/integrations/database/prisma.client';

describe('RFID Module API Tests', () => {
  let authToken = '';
  let createdCardId = '';
  let targetVehicleId = '';

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'operator@smartparking.local',
        password: env.SEED_ADMIN_PASSWORD
      });

    authToken = loginRes.body.data.token;

    // Tìm một phương tiện mẫu để test gán thẻ
    const vehicle = await prisma.vehicle.findFirst({
      where: { isActive: true }
    });
    if (vehicle) {
      targetVehicleId = vehicle.id;
    }
  });

  it('GET /api/rfid-cards should return paginated list of cards', async () => {
    const res = await request(app)
      .get('/api/rfid-cards')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
  });

  it('POST /api/rfid-cards should create card and normalize UID (strip colons, uppercase)', async () => {
    const rawUid = `aa:bb:${Date.now().toString().slice(-8)}`;
    const res = await request(app)
      .post('/api/rfid-cards')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        uid: rawUid
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.uid).not.toContain(':');
    expect(res.body.data.uid).toBe(res.body.data.uid.toUpperCase());
    expect(res.body.data.status).toBe('ACTIVE');
    createdCardId = res.body.data.id;
  });

  it('POST /api/rfid-cards should reject duplicate UID with 409', async () => {
    const res = await request(app)
      .post('/api/rfid-cards')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        uid: 'E20000190600' // Seeded UID
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RFID_UID_EXISTS');
  });

  it('POST /api/rfid-cards/:id/assign should associate card with vehicle', async () => {
    const res = await request(app)
      .post(`/api/rfid-cards/${createdCardId}/assign`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        vehicleId: targetVehicleId
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vehicleId).toBe(targetVehicleId);
  });

  it('POST /api/rfid-cards/:id/unassign should remove vehicle association', async () => {
    const res = await request(app)
      .post(`/api/rfid-cards/${createdCardId}/unassign`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vehicleId).toBeNull();
  });

  it('POST /api/rfid-cards/:id/block should set status to BLOCKED', async () => {
    const res = await request(app)
      .post(`/api/rfid-cards/${createdCardId}/block`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('BLOCKED');
  });

  it('POST /api/rfid-cards/:id/unblock should restore status to ACTIVE', async () => {
    const res = await request(app)
      .post(`/api/rfid-cards/${createdCardId}/unblock`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ACTIVE');
  });
});

