import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/integrations/database/prisma.client';
import { VehicleType, PricingType, ParkingSessionStatus, Prisma } from '@prisma/client';
import { signToken } from '../src/common/utils/jwt';

describe('ParkingSession REST API Tests (CMS Endpoints)', () => {
  const testRunId = `TEST_API_${Date.now()}`;
  let testLotId: string;
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    // 1. Tạo bãi đỗ xe
    const lot = await prisma.parkingLot.create({
      data: {
        name: `Bãi Test REST API ${testRunId}`,
        totalCapacity: 50,
        isActive: true
      }
    });
    testLotId = lot.id;

    // 2. Tạo biểu phí xe CAR (PER_HOUR)
    await prisma.pricingRule.create({
      data: {
        parkingLotId: testLotId,
        vehicleType: VehicleType.CAR,
        pricingType: PricingType.PER_HOUR,
        amount: new Prisma.Decimal('15000.00'),
        isActive: true
      }
    });

    // 3. Tạo nhân viên trực
    const user = await prisma.user.create({
      data: {
        email: `operator_api_${testRunId}@test.com`,
        fullName: 'Operator API Test',
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
    await prisma.parkingSessionPayment.deleteMany({
      where: { session: { parkingLotId: testLotId } }
    });
    await prisma.parkingSession.deleteMany({ where: { parkingLotId: testLotId } });
    await prisma.pricingRule.deleteMany({ where: { parkingLotId: testLotId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.parkingLot.delete({ where: { id: testLotId } });
  });

  it('API-01: Chặn truy cập khi thiếu Authorization token (401 Unauthorized)', async () => {
    const res = await request(app).get('/api/parking-sessions');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('API-02: POST /api/parking-sessions/manual-entry tạo phiên ACTIVE thành công (201 Created)', async () => {
    const res = await request(app)
      .post('/api/parking-sessions/manual-entry')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        parkingLotId: testLotId,
        licensePlate: `51A-API1-${Date.now().toString().slice(-4)}`,
        vehicleType: 'CAR',
        manualEntryReason: 'Vào bãi test API manual-entry'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(ParkingSessionStatus.ACTIVE);
    expect(res.body.data.isManualEntry).toBe(true);
    expect(res.body.data.manualEntryOperatorId).toBe(testUserId);
  });

  it('API-03: GET /api/parking-sessions trả về danh sách có phân trang', async () => {
    const res = await request(app)
      .get('/api/parking-sessions')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ parkingLotId: testLotId, page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('API-04: GET /api/parking-sessions/active trả về danh sách xe đang trong bãi', async () => {
    const res = await request(app)
      .get('/api/parking-sessions/active')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ parkingLotId: testLotId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.every((s: any) => s.status === 'ACTIVE')).toBe(true);
  });

  it('API-05: Toàn bộ vòng đời API: manualEntry -> calculate-fee -> confirm-payment -> manual-exit', async () => {
    // 1. manualEntry
    const entryRes = await request(app)
      .post('/api/parking-sessions/manual-entry')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        parkingLotId: testLotId,
        licensePlate: `51A-LIFECYCLE-${Date.now().toString().slice(-4)}`,
        vehicleType: 'CAR',
        manualEntryReason: 'Vào bãi test chu kỳ đầy đủ'
      });
    expect(entryRes.status).toBe(201);
    const sessionId = entryRes.body.data.id;

    // 2. GET /api/parking-sessions/:id
    const detailRes = await request(app)
      .get(`/api/parking-sessions/${sessionId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.id).toBe(sessionId);

    // 3. POST /api/parking-sessions/:id/calculate-fee (lockCutoff = true)
    const feeRes = await request(app)
      .post(`/api/parking-sessions/${sessionId}/calculate-fee`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ lockCutoff: true });
    expect(feeRes.status).toBe(200);
    expect(feeRes.body.data.session.status).toBe('PENDING_EXIT');
    expect(feeRes.body.data.feeCalculation.totalFee).toBe('15000');
    expect(feeRes.body.data.feeCalculation.amountDue).toBe('15000');

    // 4. POST /api/parking-sessions/:id/confirm-payment
    const payRes = await request(app)
      .post(`/api/parking-sessions/${sessionId}/confirm-payment`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 15000, note: 'Thu tiền mặt tại quầy' });
    expect(payRes.status).toBe(200);
    expect(payRes.body.data.session.paymentStatus).toBe('PAID');
    expect(payRes.body.data.session.paidAmount).toBe('15000');

    // 5. POST /api/parking-sessions/:id/manual-exit khi chưa xác nhận vehicleDepartedConfirmed -> Báo lỗi 400
    const failExit = await request(app)
      .post(`/api/parking-sessions/${sessionId}/manual-exit`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        manualExitReason: 'Chưa xác nhận xe đã rời bãi',
        vehicleDepartedConfirmed: false
      });
    expect(failExit.status).toBe(400);

    // 6. POST /api/parking-sessions/:id/manual-exit hợp lệ -> 200 OK COMPLETED
    const exitRes = await request(app)
      .post(`/api/parking-sessions/${sessionId}/manual-exit`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        manualExitReason: 'Đã thu tiền và xe đã rời bãi an toàn',
        vehicleDepartedConfirmed: true
      });
    expect(exitRes.status).toBe(200);
    expect(exitRes.body.data.status).toBe('COMPLETED');
    expect(exitRes.body.data.isManualExit).toBe(true);
  });

  it('API-06: POST /api/parking-sessions/:id/cancel-entry hủy phiên PENDING_ENTRY thành công', async () => {
    // Tạo 1 xe và thẻ cố định
    const vehicle = await prisma.vehicle.create({
      data: { licensePlate: `51A-CANCEL-${Date.now().toString().slice(-4)}`, vehicleType: 'CAR' }
    });
    const card = await prisma.rFIDCard.create({
      data: { uid: `CARD${Date.now().toString().slice(-8)}`, vehicleId: vehicle.id }
    });

    // Tạo phiên PENDING_ENTRY trực tiếp trong DB
    const pendingSession = await prisma.parkingSession.create({
      data: {
        parkingLotId: testLotId,
        vehicleId: vehicle.id,
        rfidCardId: card.id,
        status: ParkingSessionStatus.PENDING_ENTRY
      }
    });

    // Gọi API hủy phiên
    const cancelRes = await request(app)
      .post(`/api/parking-sessions/${pendingSession.id}/cancel-entry`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ cancelReason: 'Xe lùi lại quay đầu không vào bãi' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
    expect(cancelRes.body.data.cancelReason).toBe('Xe lùi lại quay đầu không vào bãi');

    // Dọn dẹp
    await prisma.parkingSession.delete({ where: { id: pendingSession.id } });
    await prisma.rFIDCard.delete({ where: { id: card.id } });
    await prisma.vehicle.delete({ where: { id: vehicle.id } });
  });
});
