import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { parkingSessionService } from '../src/modules/parking-sessions/parking-session.service';
import { prisma } from '../src/integrations/database/prisma.client';
import { VehicleType, RfidCardStatus, PricingType, ParkingSessionStatus, Prisma } from '@prisma/client';

describe('PostgreSQL Concurrency & Race Condition Tests (Real Database)', () => {
  const testRunId = `TEST_CON_${Date.now()}`;
  let testLotId: string;
  let operatorId: string;
  const createdCardIds: string[] = [];
  const createdVehicleIds: string[] = [];

  beforeAll(async () => {
    // 1. Tạo bãi đỗ xe có sức chứa đúng 1 chỗ duy nhất
    const lot = await prisma.parkingLot.create({
      data: {
        name: `Bãi Test Tranh Chấp ${testRunId}`,
        totalCapacity: 1,
        isActive: true
      }
    });
    testLotId = lot.id;

    // 2. Tạo biểu giá
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
        email: `operator_con_${testRunId}@test.com`,
        fullName: 'Operator Concurrency',
        role: 'OPERATOR',
        isActive: true
      }
    });
    operatorId = user.id;
  });

  afterAll(async () => {
    await prisma.parkingSessionPayment.deleteMany({
      where: { session: { parkingLotId: testLotId } }
    });
    await prisma.parkingSession.deleteMany({ where: { parkingLotId: testLotId } });
    await prisma.pricingRule.deleteMany({ where: { parkingLotId: testLotId } });
    if (createdCardIds.length > 0) {
      await prisma.rFIDCard.deleteMany({ where: { id: { in: createdCardIds } } });
    }
    if (createdVehicleIds.length > 0) {
      await prisma.vehicle.deleteMany({ where: { id: { in: createdVehicleIds } } });
    }
    await prisma.user.delete({ where: { id: operatorId } });
    await prisma.parkingLot.delete({ where: { id: testLotId } });
  });

  it('CON-01: Tranh chấp chỗ đỗ cuối cùng (10 requests đồng thời cạnh tranh 1 chỗ trống)', async () => {
    // Chuẩn bị 10 xe và 10 thẻ khác nhau
    const requestsData: Array<{ plate: string; uid: string }> = [];
    for (let i = 0; i < 10; i++) {
      const plate = `51Z${Date.now().toString().slice(-4)}${i}`;
      const uid = `UID${Date.now().toString().slice(-6)}${i}`;
      requestsData.push({ plate, uid });
    }

    // Bắn đồng thời 10 yêu cầu manualEntry qua Promise.all
    const promises = requestsData.map((req) =>
      parkingSessionService
        .manualEntry(operatorId, {
          parkingLotId: testLotId,
          licensePlate: req.plate,
          vehicleType: VehicleType.CAR,
          manualEntryReason: 'Tranh chấp chỗ cuối cùng',
          rfidCardUid: req.uid
        })
        .then((session) => {
          createdCardIds.push(session.rfidCardId);
          createdVehicleIds.push(session.vehicleId);
          return { success: true, session };
        })
        .catch((err) => {
          return { success: false, error: err };
        })
    );

    const results = await Promise.all(promises);

    // Kiểm tra kết quả
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    // KẾT QUẢ MONG ĐỢI BẢO THỦ:
    // ĐÚNG 1 request thành công, 9 request bị từ chối với lỗi PARKING_LOT_FULL
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(9);

    for (const failure of failures) {
      expect((failure as any).error.message).toContain('đã hết chỗ trống khả dụng');
    }

    // Xác minh lại trong CSDL PostgreSQL thực:
    // Chỉ có đúng 1 phiên ACTIVE được tạo ra trong bãi xe này
    const activeInDb = await prisma.parkingSession.count({
      where: {
        parkingLotId: testLotId,
        status: ParkingSessionStatus.ACTIVE
      }
    });
    expect(activeInDb).toBe(1);

    // Dọn dẹp phiên thành công để chuẩn bị cho test tiếp theo
    const winningSession = (successes[0] as any).session;
    await parkingSessionService.calculateFee(winningSession.id, true);
    await parkingSessionService.confirmPayment(operatorId, winningSession.id, { amount: 15000 });
    await parkingSessionService.manualExit(operatorId, winningSession.id, {
      manualExitReason: 'Dọn dẹp',
      vehicleDepartedConfirmed: true
    });
  });

  it('CON-02: Tranh chấp quẹt thẻ vãng lai đồng thời (2 xe cùng quẹt 1 thẻ RFID tại cùng 1 thời điểm)', async () => {
    const sharedCardUid = `SHARED_${Date.now().toString().slice(-6)}`;
    const card = await prisma.rFIDCard.create({
      data: { uid: sharedCardUid, status: RfidCardStatus.ACTIVE }
    });
    createdCardIds.push(card.id);

    const req1 = parkingSessionService
      .manualEntry(operatorId, {
        parkingLotId: testLotId,
        licensePlate: '51A-RACE1',
        vehicleType: VehicleType.CAR,
        manualEntryReason: 'Xe 1 quẹt thẻ',
        rfidCardUid: sharedCardUid
      })
      .then((s) => {
        createdVehicleIds.push(s.vehicleId);
        return { success: true, s };
      })
      .catch((e) => ({ success: false, e }));

    const req2 = parkingSessionService
      .manualEntry(operatorId, {
        parkingLotId: testLotId,
        licensePlate: '51A-RACE2',
        vehicleType: VehicleType.CAR,
        manualEntryReason: 'Xe 2 quẹt thẻ',
        rfidCardUid: sharedCardUid
      })
      .then((s) => {
        createdVehicleIds.push(s.vehicleId);
        return { success: true, s };
      })
      .catch((e) => ({ success: false, e }));

    const [res1, res2] = await Promise.all([req1, req2]);

    // Đúng 1 xe thành công, xe kia thất bại
    const successCount = [res1, res2].filter((r) => r.success).length;
    const failureCount = [res1, res2].filter((r) => !r.success).length;

    expect(successCount).toBe(1);
    expect(failureCount).toBe(1);

    // Dọn dẹp
    const winner = res1.success ? (res1 as any).s : (res2 as any).s;
    await parkingSessionService.calculateFee(winner.id, true);
    await parkingSessionService.confirmPayment(operatorId, winner.id, { amount: 15000 });
    await parkingSessionService.manualExit(operatorId, winner.id, {
      manualExitReason: 'Dọn dẹp',
      vehicleDepartedConfirmed: true
    });
  });

  it('CON-03: Xung đột giữa Entry Timeout và Confirm Passage (Giải quyết nguyên tử bằng khóa dòng)', async () => {
    // Tạo 1 xe và thẻ cố định
    const vehicle = await prisma.vehicle.create({
      data: { licensePlate: `51A-PASS-${Date.now().toString().slice(-4)}`, vehicleType: VehicleType.CAR }
    });
    createdVehicleIds.push(vehicle.id);

    const cardUid = `PASS${Date.now().toString().slice(-6)}`;
    const card = await prisma.rFIDCard.create({
      data: { uid: cardUid, vehicleId: vehicle.id, status: RfidCardStatus.ACTIVE }
    });
    createdCardIds.push(card.id);

    // Mở phiên PENDING_ENTRY
    const session = await parkingSessionService.requestEntry({
      parkingLotId: testLotId,
      cardUid: cardUid
    });
    expect(session.status).toBe(ParkingSessionStatus.PENDING_ENTRY);

    // Chạy đồng thời 2 luồng: confirmEntryPassage và cancelExpiredEntrySession
    const p1 = parkingSessionService
      .confirmEntryPassage(session.id)
      .then(() => ({ action: 'PASSAGE_CONFIRMED' }))
      .catch((err) => ({ action: 'PASSAGE_FAILED', error: err }));

    const p2 = parkingSessionService
      .cancelExpiredEntrySession(session.id, 'TIMEOUT_CLEANUP')
      .then((res) => ({ action: res ? 'TIMEOUT_CANCELLED' : 'TIMEOUT_SKIPPED' }))
      .catch((err) => ({ action: 'TIMEOUT_ERROR', error: err }));

    const [r1, r2] = await Promise.all([p1, p2]);

    // Kiểm tra trạng thái cuối cùng trong CSDL: Phải là ACTIVE hoặc CANCELLED, không bao giờ ở trạng thái nửa vời
    const finalSession = await prisma.parkingSession.findUnique({ where: { id: session.id } });
    expect(['ACTIVE', 'CANCELLED']).toContain(finalSession?.status);

    if (finalSession?.status === 'ACTIVE') {
      expect(r1.action).toBe('PASSAGE_CONFIRMED');
      expect(r2.action).toBe('TIMEOUT_SKIPPED');

      // Dọn dẹp
      await parkingSessionService.calculateFee(session.id, true);
      await parkingSessionService.confirmPayment(operatorId, session.id, { amount: 15000 });
      await parkingSessionService.manualExit(operatorId, session.id, {
        manualExitReason: 'Dọn dẹp',
        vehicleDepartedConfirmed: true
      });
    } else {
      expect(finalSession?.status).toBe('CANCELLED');
    }
  });
});
