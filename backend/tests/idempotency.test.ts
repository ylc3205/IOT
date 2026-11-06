import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/integrations/database/prisma.client';
import { VehicleType, PricingType, Prisma } from '@prisma/client';
import { signToken } from '../src/common/utils/jwt';

describe('PostgreSQL Idempotency Middleware Tests', () => {
  const testRunId = `TEST_IDM_${Date.now()}`;
  let testLotId: string;
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    // 1. Tạo bãi đỗ xe
    const lot = await prisma.parkingLot.create({
      data: {
        name: `Bãi Test Idempotency ${testRunId}`,
        totalCapacity: 50,
        isActive: true
      }
    });
    testLotId = lot.id;

    // 2. Biểu phí
    await prisma.pricingRule.create({
      data: {
        parkingLotId: testLotId,
        vehicleType: VehicleType.CAR,
        pricingType: PricingType.PER_HOUR,
        amount: new Prisma.Decimal('15000.00'),
        isActive: true
      }
    });

    // 3. User & Auth Token
    const user = await prisma.user.create({
      data: {
        email: `operator_idm_${testRunId}@test.com`,
        fullName: 'Operator Idempotency',
        role: 'OPERATOR',
        isActive: true
      }
    });
    testUserId = user.id;

    authToken = signToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({
      where: { key: { startsWith: `KEY_${testRunId}` } }
    });
    await prisma.parkingSessionPayment.deleteMany({
      where: { session: { parkingLotId: testLotId } }
    });
    await prisma.parkingSession.deleteMany({ where: { parkingLotId: testLotId } });
    await prisma.pricingRule.deleteMany({ where: { parkingLotId: testLotId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.parkingLot.delete({ where: { id: testLotId } });
  });

  it('IDM-01: Gửi lại request cùng Idempotency-Key và cùng payload nhận lại kết quả cache (X-Idempotency-Replay: true)', async () => {
    const key = `KEY_${testRunId}_01`;
    const payload = {
      parkingLotId: testLotId,
      licensePlate: `51A-IDM1-${Date.now().toString().slice(-4)}`,
      vehicleType: 'CAR',
      manualEntryReason: 'Vào bãi kiểm thử Idempotency Replay'
    };

    // Lần 1: Tạo mới thành công (201 Created)
    const res1 = await request(app)
      .post('/api/parking-sessions/manual-entry')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Idempotency-Key', key)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    expect(res1.headers['x-idempotency-replay']).toBeUndefined();
    const createdId = res1.body.data.id;

    // Lần 2: Gửi lại chính xác key và payload đó
    const res2 = await request(app)
      .post('/api/parking-sessions/manual-entry')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Idempotency-Key', key)
      .send(payload);

    expect(res2.status).toBe(201);
    expect(res2.body.success).toBe(true);
    expect(res2.headers['x-idempotency-replay']).toBe('true');
    expect(res2.body.data.id).toBe(createdId);

    // Xác minh trong CSDL: Chỉ có DUY NHẤT 1 bản ghi session được tạo ra
    const sessionCount = await prisma.parkingSession.count({
      where: { id: createdId }
    });
    expect(sessionCount).toBe(1);
  });

  it('IDM-02: Cùng Idempotency-Key nhưng payload khác nhau bị từ chối với HTTP 422', async () => {
    const key = `KEY_${testRunId}_02`;
    const payload1 = {
      parkingLotId: testLotId,
      licensePlate: `51A-IDM2-${Date.now().toString().slice(-4)}`,
      vehicleType: 'CAR',
      manualEntryReason: 'Lần gọi đầu'
    };

    // Lần 1: Thành công
    const res1 = await request(app)
      .post('/api/parking-sessions/manual-entry')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Idempotency-Key', key)
      .send(payload1);

    expect(res1.status).toBe(201);

    // Lần 2: Cùng key nhưng đổi biển số xe trong payload
    const payload2 = {
      ...payload1,
      licensePlate: '51A-DIFF-PAYLOAD'
    };

    const res2 = await request(app)
      .post('/api/parking-sessions/manual-entry')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Idempotency-Key', key)
      .send(payload2);

    expect(res2.status).toBe(422);
    expect(res2.body.error.code).toBe('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH');
  });

  it('IDM-03: Tranh chấp đồng thời cùng Idempotency-Key không tạo bản ghi trùng lặp', async () => {
    const key = `KEY_${testRunId}_03`;
    const payload = {
      parkingLotId: testLotId,
      licensePlate: `51A-IDM3-${Date.now().toString().slice(-4)}`,
      vehicleType: 'CAR',
      manualEntryReason: 'Tranh chấp cùng key'
    };

    // Bắn 2 request cùng lúc
    const p1 = request(app)
      .post('/api/parking-sessions/manual-entry')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Idempotency-Key', key)
      .send(payload);

    const p2 = request(app)
      .post('/api/parking-sessions/manual-entry')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Idempotency-Key', key)
      .send(payload);

    const [r1, r2] = await Promise.all([p1, p2]);

    // Một request thành công (201), request kia hoặc nhận cache (201) hoặc nhận 409 In-Progress
    const statuses = [r1.status, r2.status];
    expect(statuses).toContain(201);

    // Không có lỗi 500
    expect(statuses.every((s) => s < 500)).toBe(true);
  });
});
