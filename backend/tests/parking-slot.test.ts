import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/integrations/database/prisma.client';

describe('ParkingSlot Module API Tests', () => {
  let authToken = '';
  const seededLotId = '00000000-0000-0000-0000-000000000001';
  let sensorDeviceId = '';
  let createdSlotId = '';

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'operator@smartparking.local',
        password: env.SEED_ADMIN_PASSWORD
      });

    authToken = loginRes.body.data.token;

    // Lấy ID của device SENSOR_NODE_01 đã được seed
    const sensorDevice = await prisma.device.findUnique({
      where: { deviceCode: 'SENSOR_NODE_01' }
    });
    if (sensorDevice) {
      sensorDeviceId = sensorDevice.id;
    }
  });

  it('GET /api/parking-lots/:lotId/slots should return slot list for lot', async () => {
    const res = await request(app)
      .get(`/api/parking-lots/${seededLotId}/slots`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/parking-lots/:lotId/slots should create a new slot without sensor mapping', async () => {
    const slotCode = `TEST-${Date.now()}`;
    const res = await request(app)
      .post(`/api/parking-lots/${seededLotId}/slots`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        slotCode,
        operationalStatus: 'AVAILABLE'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slotCode).toBe(slotCode);
    expect(res.body.data.sensorStatus).toBe('UNKNOWN');
    createdSlotId = res.body.data.id;
  });

  it('POST /api/parking-lots/:lotId/slots should reject duplicate slotCode within the same lot', async () => {
    const res = await request(app)
      .post(`/api/parking-lots/${seededLotId}/slots`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        slotCode: 'A-01',
        operationalStatus: 'AVAILABLE'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PARKING_SLOT_CODE_EXISTS');
  });

  it('POST /api/parking-lots/:lotId/slots should reject sensorDeviceId without sensorChannel (pairing violation)', async () => {
    const res = await request(app)
      .post(`/api/parking-lots/${seededLotId}/slots`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        slotCode: `PAIR-${Date.now()}`,
        sensorDeviceId
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/parking-lots/:lotId/slots should reject sensor mapping conflict (channel already assigned)', async () => {
    // Channel 1 on SENSOR_NODE_01 was assigned to B-01 in seed
    const res = await request(app)
      .post(`/api/parking-lots/${seededLotId}/slots`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        slotCode: `CONFLICT-${Date.now()}`,
        sensorDeviceId,
        sensorChannel: 1
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PARKING_SLOT_SENSOR_CONFLICT');
  });

  it('GET /api/parking-slots/:id should return single slot with relation details', async () => {
    const res = await request(app)
      .get(`/api/parking-slots/${createdSlotId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdSlotId);
    expect(res.body.data.parkingLot).toBeDefined();
  });

  it('PATCH /api/parking-slots/:id should update operational status', async () => {
    const res = await request(app)
      .patch(`/api/parking-slots/${createdSlotId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        operationalStatus: 'MAINTENANCE'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.operationalStatus).toBe('MAINTENANCE');
  });
});

