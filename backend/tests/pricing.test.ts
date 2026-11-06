import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/integrations/database/prisma.client';

describe('Pricing Module API Tests', () => {
  let authToken = '';
  let testLotId = '';
  let createdRuleId = '';

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'operator@smartparking.local',
        password: env.SEED_ADMIN_PASSWORD
      });

    authToken = loginRes.body.data.token;

    // Tạo bãi xe độc lập phục vụ kiểm thử biểu phí
    const lot = await prisma.parkingLot.create({
      data: {
        name: `Pricing Test Lot ${Date.now()}`,
        totalCapacity: 30
      }
    });
    testLotId = lot.id;
  });

  afterAll(async () => {
    try {
      if (testLotId) {
        await prisma.pricingRule.deleteMany({ where: { parkingLotId: testLotId } });
        await prisma.parkingLot.delete({ where: { id: testLotId } });
      }
    } catch {
      // Ignored
    }
  });

  it('GET /api/pricing-rules should return list of configured pricing rules', async () => {
    const res = await request(app)
      .get('/api/pricing-rules')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('POST /api/pricing-rules should create a new rule for (MOTORBIKE, PER_HOUR)', async () => {
    const res = await request(app)
      .post('/api/pricing-rules')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        parkingLotId: testLotId,
        vehicleType: 'MOTORBIKE',
        pricingType: 'PER_HOUR',
        amount: 3000
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.amount)).toBe(3000);
    createdRuleId = res.body.data.id;
  });

  it('POST /api/pricing-rules should reject duplicate rule on (lot, vehicleType, pricingType)', async () => {
    const res = await request(app)
      .post('/api/pricing-rules')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        parkingLotId: testLotId,
        vehicleType: 'MOTORBIKE',
        pricingType: 'PER_HOUR', // Duplicate with previous test
        amount: 5000
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PRICING_RULE_EXISTS');
  });

  it('POST /api/pricing-rules should reject negative amount with 400', async () => {
    const res = await request(app)
      .post('/api/pricing-rules')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        parkingLotId: testLotId,
        vehicleType: 'CAR',
        pricingType: 'PER_VISIT',
        amount: -5000
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH /api/pricing-rules/:id should update rule amount', async () => {
    const res = await request(app)
      .patch(`/api/pricing-rules/${createdRuleId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 3500
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.amount)).toBe(3500);
  });
});
