import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { parkingSessionService } from '../src/modules/parking-sessions/parking-session.service';
import { prisma } from '../src/integrations/database/prisma.client';
import { VehicleType, RfidCardStatus, PricingType, ParkingSessionStatus, Prisma } from '@prisma/client';

describe('ParkingSession Lifecycle & Multi-Payment Tests', () => {
  const testRunId = `TEST_LIF_${Date.now()}`;
  let testLotId: string;
  let testUserId: string;
  let fixedVehicleId: string;
  let fixedCardId: string;
  let fixedCardUid: string;
  let visitorCardId: string;
  let visitorCardUid: string;

  beforeAll(async () => {
    // 1. Tạo bãi xe
    const lot = await prisma.parkingLot.create({
      data: {
        name: `Bãi Test Vòng Đời ${testRunId}`,
        totalCapacity: 20,
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
        email: `operator_${testRunId}@test.com`,
        fullName: 'Operator Test',
        role: 'OPERATOR',
        isActive: true
      }
    });
    testUserId = user.id;

    // 4. Tạo xe cố định và thẻ cố định
    const vehicle = await prisma.vehicle.create({
      data: {
        licensePlate: `51F${Date.now().toString().slice(-6)}`,
        vehicleType: VehicleType.CAR,
        isActive: true
      }
    });
    fixedVehicleId = vehicle.id;

    fixedCardUid = `FIX${Date.now().toString().slice(-8)}`;
    const fixedCard = await prisma.rFIDCard.create({
      data: {
        uid: fixedCardUid,
        vehicleId: fixedVehicleId,
        status: RfidCardStatus.ACTIVE
      }
    });
    fixedCardId = fixedCard.id;

    // 5. Tạo thẻ vãng lai (vehicleId == null)
    visitorCardUid = `VIS${Date.now().toString().slice(-8)}`;
    const visitorCard = await prisma.rFIDCard.create({
      data: {
        uid: visitorCardUid,
        vehicleId: null,
        status: RfidCardStatus.ACTIVE
      }
    });
    visitorCardId = visitorCard.id;
  });

  afterAll(async () => {
    await prisma.parkingSessionPayment.deleteMany({
      where: { session: { parkingLotId: testLotId } }
    });
    await prisma.parkingSession.deleteMany({ where: { parkingLotId: testLotId } });
    await prisma.pricingRule.deleteMany({ where: { parkingLotId: testLotId } });
    await prisma.rFIDCard.deleteMany({ where: { id: { in: [fixedCardId, visitorCardId] } } });
    await prisma.vehicle.deleteMany({ where: { id: fixedVehicleId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.parkingLot.delete({ where: { id: testLotId } });
  });

  it('LIF-01: Chu kỳ đầy đủ: requestEntry -> confirmEntryPassage -> calculateFee -> confirmPayment -> manualExit', async () => {
    // 1. Quét thẻ vào bãi
    const session = await parkingSessionService.requestEntry({
      parkingLotId: testLotId,
      cardUid: fixedCardUid
    });
    expect(session.status).toBe(ParkingSessionStatus.PENDING_ENTRY);
    expect(session.pricingRate?.toString()).toBe('15000');

    // 2. Xe qua barrier vào bãi
    const activeSession = await parkingSessionService.confirmEntryPassage(session.id);
    expect(activeSession.status).toBe(ParkingSessionStatus.ACTIVE);

    // 3. Tính tiền tại cổng ra (lockCutoff = true)
    const { session: pendingExitSession, feeResult } = await parkingSessionService.calculateFee(session.id, true);
    expect(pendingExitSession.status).toBe(ParkingSessionStatus.PENDING_EXIT);
    expect(feeResult.totalFee.toString()).toBe('15000');

    // 4. Thu tiền mặt tại quầy
    const { session: paidSession } = await parkingSessionService.confirmPayment(testUserId, session.id, {
      amount: 15000
    });
    expect(paidSession.paidAmount.toString()).toBe('15000');
    expect(paidSession.paymentStatus).toBe('PAID');
    // Phiên vẫn giữ trạng thái PENDING_EXIT
    expect(paidSession.status).toBe(ParkingSessionStatus.PENDING_EXIT);

    // 5. Xác nhận xe rời bãi thủ công
    const completedSession = await parkingSessionService.manualExit(testUserId, session.id, {
      manualExitReason: 'Thu đủ tiền mặt, cho xe xuất bãi',
      vehicleDepartedConfirmed: true
    });
    expect(completedSession.status).toBe(ParkingSessionStatus.COMPLETED);
    expect(completedSession.isManualExit).toBe(true);
    expect(completedSession.exitTime).toBeDefined();
  });

  it('LIF-02: Tái sử dụng thẻ Vãng lai (Visitor RFID) trơn tru sau khi phiên COMPLETED', async () => {
    // 1. Xe vãng lai 1 vào bãi bằng manualEntry với thẻ vãng lai
    const session1 = await parkingSessionService.manualEntry(testUserId, {
      parkingLotId: testLotId,
      licensePlate: '51G-111.11',
      vehicleType: VehicleType.CAR,
      manualEntryReason: 'Cấp thẻ vãng lai tại cổng vào',
      rfidCardUid: visitorCardUid
    });
    expect(session1.status).toBe(ParkingSessionStatus.ACTIVE);

    // 2. Chốt cước và thu tiền
    await parkingSessionService.calculateFee(session1.id, true);
    await parkingSessionService.confirmPayment(testUserId, session1.id, { amount: 15000 });

    // 3. Cho xe 1 ra bãi -> COMPLETED
    await parkingSessionService.manualExit(testUserId, session1.id, {
      manualExitReason: 'Xe 1 hoàn thành lượt gửi',
      vehicleDepartedConfirmed: true
    });

    // 4. Xe vãng lai 2 vào bãi dùng NGAY CHÍNH CHIẾC THẺ VÃNG LAI ĐÓ
    const session2 = await parkingSessionService.manualEntry(testUserId, {
      parkingLotId: testLotId,
      licensePlate: '51G-222.22',
      vehicleType: VehicleType.CAR,
      manualEntryReason: 'Tái cấp thẻ vãng lai cho khách tiếp theo',
      rfidCardUid: visitorCardUid
    });

    expect(session2.status).toBe(ParkingSessionStatus.ACTIVE);
    expect(session2.id).not.toBe(session1.id);

    // Dọn dẹp session2
    await parkingSessionService.calculateFee(session2.id, true);
    await parkingSessionService.confirmPayment(testUserId, session2.id, { amount: 15000 });
    await parkingSessionService.manualExit(testUserId, session2.id, {
      manualExitReason: 'Dọn dẹp test session 2',
      vehicleDepartedConfirmed: true
    });
  });

  it('LIF-03: Thẻ ở trạng thái PENDING_EXIT chưa được giải phóng khỏi CSDL', async () => {
    // Mở phiên mới
    const session = await parkingSessionService.manualEntry(testUserId, {
      parkingLotId: testLotId,
      licensePlate: '51H-333.33',
      vehicleType: VehicleType.CAR,
      manualEntryReason: 'Test PENDING_EXIT lock',
      rfidCardUid: visitorCardUid
    });

    // Chuyển sang PENDING_EXIT
    await parkingSessionService.calculateFee(session.id, true);

    // Cố mở phiên khác với cùng chiếc thẻ đó -> Bị chặn bởi active session guard / partial unique index
    await expect(
      parkingSessionService.manualEntry(testUserId, {
        parkingLotId: testLotId,
        licensePlate: '51H-444.44',
        vehicleType: VehicleType.CAR,
        manualEntryReason: 'Cố tình quẹt thẻ khi xe cũ đang ở PENDING_EXIT',
        rfidCardUid: visitorCardUid
      })
    ).rejects.toThrow('đang có một phiên gửi xe chưa hoàn tất');

    // Dọn dẹp
    await parkingSessionService.confirmPayment(testUserId, session.id, { amount: 15000 });
    await parkingSessionService.manualExit(testUserId, session.id, {
      manualExitReason: 'Hoàn tất test',
      vehicleDepartedConfirmed: true
    });
  });

  it('LIF-04: Thẻ RFID bị khóa (BLOCKED) bị từ chối ngay tại cổng vào', async () => {
    // Tạm khóa thẻ cố định
    await prisma.rFIDCard.update({
      where: { id: fixedCardId },
      data: { status: RfidCardStatus.BLOCKED }
    });

    await expect(
      parkingSessionService.requestEntry({
        parkingLotId: testLotId,
        cardUid: fixedCardUid
      })
    ).rejects.toThrow('không thể sử dụng để vào bãi');

    // Mở khóa lại
    await prisma.rFIDCard.update({
      where: { id: fixedCardId },
      data: { status: RfidCardStatus.ACTIVE }
    });
  });

  it('LIF-05: Mất thẻ vãng lai được giải cứu qua manualExit không thu phí phạt', async () => {
    const session = await parkingSessionService.manualEntry(testUserId, {
      parkingLotId: testLotId,
      licensePlate: '51K-555.55',
      vehicleType: VehicleType.CAR,
      manualEntryReason: 'Vào bãi test mất thẻ',
      rfidCardUid: visitorCardUid
    });

    // Tính cước bình thường
    await parkingSessionService.calculateFee(session.id, true);
    await parkingSessionService.confirmPayment(testUserId, session.id, { amount: 15000 });

    // Khách làm mất thẻ -> Cho ra thủ công, đánh dấu thẻ LOST, KHÔNG THU PHÍ PHẠT
    const res = await parkingSessionService.manualExit(testUserId, session.id, {
      manualExitReason: 'Khách mất thẻ vãng lai, đã đối chiếu CCCD và đăng ký xe, thu đúng cước đỗ',
      vehicleDepartedConfirmed: true,
      markCardAsLost: true
    });

    expect(res.status).toBe(ParkingSessionStatus.COMPLETED);

    // Thẻ được cập nhật trạng thái LOST an toàn
    const updatedCard = await prisma.rFIDCard.findUnique({ where: { id: visitorCardId } });
    expect(updatedCard?.status).toBe(RfidCardStatus.LOST);

    // Mở lại ACTIVE cho các bài test sau
    await prisma.rFIDCard.update({
      where: { id: visitorCardId },
      data: { status: RfidCardStatus.ACTIVE }
    });
  });

  it('LIF-06: Hủy phiên vào (cancelEntry) khi ở PENDING_ENTRY giải phóng xe và thẻ', async () => {
    const session = await parkingSessionService.requestEntry({
      parkingLotId: testLotId,
      cardUid: fixedCardUid
    });
    expect(session.status).toBe(ParkingSessionStatus.PENDING_ENTRY);

    const cancelled = await parkingSessionService.cancelEntry(session.id, {
      cancelReason: 'Xe lùi lại quay đầu không vào bãi'
    });
    expect(cancelled.status).toBe(ParkingSessionStatus.CANCELLED);
    expect(cancelled.cancelledAt).toBeDefined();

    // Thẻ và xe sẵn sàng mở phiên mới ngay
    const newSession = await parkingSessionService.requestEntry({
      parkingLotId: testLotId,
      cardUid: fixedCardUid
    });
    expect(newSession.status).toBe(ParkingSessionStatus.PENDING_ENTRY);

    // Dọn dẹp
    await parkingSessionService.cancelEntry(newSession.id, { cancelReason: 'Dọn dẹp' });
  });

  it('LIF-07: Cấm hủy phiên vào khi xe đã ACTIVE', async () => {
    const session = await parkingSessionService.requestEntry({
      parkingLotId: testLotId,
      cardUid: fixedCardUid
    });
    await parkingSessionService.confirmEntryPassage(session.id); // sang ACTIVE

    await expect(
      parkingSessionService.cancelEntry(session.id, { cancelReason: 'Cố tình hủy khi xe đã vào bãi' })
    ).rejects.toThrow('Chỉ có thể hủy phiên đang ở trạng thái PENDING_ENTRY');

    // Dọn dẹp
    await parkingSessionService.calculateFee(session.id, true);
    await parkingSessionService.confirmPayment(testUserId, session.id, { amount: 15000 });
    await parkingSessionService.manualExit(testUserId, session.id, {
      manualExitReason: 'Dọn dẹp',
      vehicleDepartedConfirmed: true
    });
  });

  it('LIF-08: Cấm hoàn thành phiên khi chưa thanh toán đủ tiền', async () => {
    const session = await parkingSessionService.manualEntry(testUserId, {
      parkingLotId: testLotId,
      licensePlate: '51L-888.88',
      vehicleType: VehicleType.CAR,
      manualEntryReason: 'Test chặn chưa trả tiền',
      rfidCardUid: visitorCardUid
    });

    await parkingSessionService.calculateFee(session.id, true);

    // Chưa nộp tiền (amountDue = 15000), cố tình gọi manualExit
    await expect(
      parkingSessionService.manualExit(testUserId, session.id, {
        manualExitReason: 'Trốn phí',
        vehicleDepartedConfirmed: true
      })
    ).rejects.toThrow('chưa thanh toán đủ cước phí');

    // Dọn dẹp
    await parkingSessionService.confirmPayment(testUserId, session.id, { amount: 15000 });
    await parkingSessionService.manualExit(testUserId, session.id, {
      manualExitReason: 'Dọn dẹp',
      vehicleDepartedConfirmed: true
    });
  });

  it('LIF-09: Cấm ra bãi thủ công (manualExit) từ PENDING_ENTRY', async () => {
    const session = await parkingSessionService.requestEntry({
      parkingLotId: testLotId,
      cardUid: fixedCardUid
    });

    await expect(
      parkingSessionService.manualExit(testUserId, session.id, {
        manualExitReason: 'Xe chưa vào đã đòi ra thủ công',
        vehicleDepartedConfirmed: true
      })
    ).rejects.toThrow('Chỉ cho phép từ ACTIVE hoặc PENDING_EXIT');

    // Dọn dẹp
    await parkingSessionService.cancelEntry(session.id, { cancelReason: 'Dọn dẹp' });
  });

  it('LIF-10: Thanh toán nhiều đợt & Phụ thu quá hạn ân hạn: Không thu trùng tiền', async () => {
    const session = await parkingSessionService.manualEntry(testUserId, {
      parkingLotId: testLotId,
      licensePlate: '51M-999.99',
      vehicleType: VehicleType.CAR,
      manualEntryReason: 'Test phụ thu nhiều đợt',
      rfidCardUid: visitorCardUid
    });

    // 1. Chốt cước đợt 1 (15k)
    await parkingSessionService.calculateFee(session.id, true);

    // 2. Nộp tiền đợt 1 (15k)
    const { paymentRecord: p1 } = await parkingSessionService.confirmPayment(testUserId, session.id, {
      amount: 15000,
      note: 'Thanh toán đợt 1'
    });
    expect(p1.amount.toString()).toBe('15000');

    // 3. Giả lập xe nán lại bãi quá hạn ân hạn và thời gian đỗ nhảy sang 2 giờ
    // Lùi entryTime về quá khứ 100 phút trước
    const entryPast = new Date(Date.now() - 100 * 60 * 1000);
    // lastPaymentTime là 20 phút trước (vượt quá 10 phút ân hạn)
    const paymentPast = new Date(Date.now() - 20 * 60 * 1000);

    await prisma.parkingSession.update({
      where: { id: session.id },
      data: {
        entryTime: entryPast,
        paymentTime: paymentPast
      }
    });

    // 4. Khi xe cố ra bãi, phát hiện quá giờ ân hạn -> Ném lỗi ADDITIONAL_PAYMENT_REQUIRED
    await expect(
      parkingSessionService.manualExit(testUserId, session.id, {
        manualExitReason: 'Cố ra khi quá giờ ân hạn',
        vehicleDepartedConfirmed: true
      })
    ).rejects.toThrow('quá thời gian ân hạn rời bãi và phát sinh thêm cước');

    // 5. Kiểm tra dữ liệu phiên trong CSDL:
    // totalFee tăng lên 30k, paidAmount vẫn bảo toàn 15k, còn thiếu đúng 15k!
    const sessionReload = await parkingSessionService.getSessionById(session.id);
    expect(sessionReload.totalFee.toString()).toBe('30000');
    expect(sessionReload.paidAmount.toString()).toBe('15000');
    expect(sessionReload.paymentStatus).toBe('UNPAID');

    // 6. Nộp tiếp đợt 2: Đúng 15,000 VND phụ thu (KHÔNG THU 30,000)
    const { paymentRecord: p2 } = await parkingSessionService.confirmPayment(testUserId, session.id, {
      amount: 15000,
      note: 'Phụ thu quá giờ'
    });
    expect(p2.amount.toString()).toBe('15000');

    // 7. Cho xe ra bãi thành công sau khi đã thu đủ 2 đợt
    const finalSession = await parkingSessionService.manualExit(testUserId, session.id, {
      manualExitReason: 'Đã nộp đủ 2 đợt cước, cho xe ra an toàn',
      vehicleDepartedConfirmed: true
    });

    expect(finalSession.status).toBe(ParkingSessionStatus.COMPLETED);
    expect(finalSession.paidAmount.toString()).toBe('30000');

    // 8. Kiểm tra lịch sử thanh toán có đúng 2 bản ghi độc lập
    const payments = await prisma.parkingSessionPayment.findMany({
      where: { sessionId: session.id },
      orderBy: { paymentTime: 'asc' }
    });
    expect(payments.length).toBe(2);
    expect(payments[0].amount.toString()).toBe('15000');
    expect(payments[1].amount.toString()).toBe('15000');
  });
});
