import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';

describe('ParkingLot Module API Tests', () => {
  let authToken = '';
  let createdLotId = '';

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'operator@smartparking.local',
        password: env.SEED_ADMIN_PASSWORD
      });

    authToken = res.body.data.token;
  });

  it('GET /api/parking-lots should list lots with pagination structure', async () => {
    const res = await request(app)
      .get('/api/parking-lots')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.page).toBe(1);
  });

  it('POST /api/parking-lots should create a new parking lot', async () => {
    const res = await request(app)
      .post('/api/parking-lots')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `Bãi đỗ kiểm thử ${Date.now()}`,
        location: 'Tòa nhà Thí nghiệm Kỹ thuật',
        totalCapacity: 50
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalCapacity).toBe(50);
    createdLotId = res.body.data.id;
  });

  it('GET /api/parking-lots/:id should return single lot details', async () => {
    const res = await request(app)
      .get(`/api/parking-lots/${createdLotId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdLotId);
  });

  it('PATCH /api/parking-lots/:id should update parking lot properties', async () => {
    const res = await request(app)
      .patch(`/api/parking-lots/${createdLotId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Bãi đỗ kiểm thử đã cập nhật',
        totalCapacity: 60
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Bãi đỗ kiểm thử đã cập nhật');
    expect(res.body.data.totalCapacity).toBe(60);
  });

  it('GET /api/parking-lots/:id/occupancy should return calculated occupancy metrics', async () => {
    // Test on default seeded lot
    const seededLotId = '00000000-0000-0000-0000-000000000001';
    const res = await request(app)
      .get(`/api/parking-lots/${seededLotId}/occupancy`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('parkingLotId', seededLotId);
    expect(res.body.data).toHaveProperty('configuredSlots');
    expect(res.body.data).toHaveProperty('available');
    expect(res.body.data).toHaveProperty('occupied');
    expect(res.body.data).toHaveProperty('maintenance');
    expect(res.body.data).toHaveProperty('unknown');
  });
});

