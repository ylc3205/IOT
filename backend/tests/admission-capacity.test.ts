import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AdmissionService } from '../src/modules/parking-sessions/admission.service';
import { prisma } from '../src/integrations/database/prisma.client';
import { VehicleType, RfidCardStatus, ParkingSessionStatus } from '@prisma/client';

describe('Admission Capacity & Zero Double-Counting Tests', () => {
  const testRunId = `TEST_ADM_${Date.now()}`;
  let testLotId: string;
  let vehicleId: string;
  let rfidCardId: string;

  beforeAll(async () => {
    // Tạo bãi xe thử nghiệm với capacity 5
    const lot = await prisma.parkingLot.create({
      data: {
        name: `Bãi Test Sức Chứa ${testRunId}`,
        totalCapacity: 5,
        isActive: true
      }
    });
    testLotId = lot.id;

    const vehicle = await prisma.vehicle.create({
      data: {
        licensePlate: `51A${Date.now().toString().slice(-6)}`,
        vehicleType: VehicleType.CAR,
        isActive: true
      }
    });
    vehicleId = vehicle.id;

    const rfid = await prisma.rFIDCard.create({
      data: {
        uid: `ADM${Date.now().toString().slice(-8)}`,
        status: RfidCardStatus.ACTIVE
      }
    });
    rfidCardId = rfid.id;
  });

  afterAll(async () => {
    await prisma.parkingSession.deleteMany({ where: { parkingLotId: testLotId } });
    await prisma.parkingSlot.deleteMany({ where: { parkingLotId: testLotId } });
    await prisma.rFIDCard.delete({ where: { id: rfidCardId } });
    await prisma.vehicle.delete({ where: { id: vehicleId } });
    await prisma.parkingLot.delete({ where: { id: testLotId } });
  });

  it('ADM-01: Ô đỗ vừa MAINTENANCE vừa UNKNOWN chỉ bị trừ 1 lần duy nhất (Zero Double-Subtraction)', async () => {
    // Tạo 3 ô đỗ:
    // Slot 1: AVAILABLE, EMPTY
    // Slot 2: AVAILABLE, EMPTY
    // Slot 3: MAINTENANCE, sensorStatus: UNKNOWN
    await prisma.parkingSlot.createMany({
      data: [
        { parkingLotId: testLotId, slotCode: 'A-01', operationalStatus: 'AVAILABLE', sensorStatus: 'EMPTY' },
        { parkingLotId: testLotId, slotCode: 'A-02', operationalStatus: 'AVAILABLE', sensorStatus: 'EMPTY' },
        { parkingLotId: testLotId, slotCode: 'A-03', operationalStatus: 'MAINTENANCE', sensorStatus: 'UNKNOWN' }
      ]
    });

    const res = await prisma.$transaction(async (tx) => {
      return AdmissionService.executeConservativeAdmission(tx, testLotId);
    });

    expect(res.maintenanceCount).toBe(1);
    expect(res.unknownCount).toBe(0); // Không đếm ô bảo trì vào unknown
    // Total configured slots = 3. 1 slot hỏng/bảo trì. Còn 2 slots healthy.
    // logicalOccupied = 0.
    // SafeAvailable = min(5 - 0, 2 - 0) = 2.
    expect(res.safeAvailableSpaces).toBe(2);

    await prisma.parkingSlot.deleteMany({ where: { parkingLotId: testLotId } });
  });

  it('ADM-02: Phiên PENDING_ENTRY (Reservation) chiếm 1 suất giữ chỗ ngay lập tức', async () => {
    // Tạo bãi có 2 ô đỗ trống
    await prisma.parkingSlot.createMany({
      data: [
        { parkingLotId: testLotId, slotCode: 'B-01', operationalStatus: 'AVAILABLE', sensorStatus: 'EMPTY' },
        { parkingLotId: testLotId, slotCode: 'B-02', operationalStatus: 'AVAILABLE', sensorStatus: 'EMPTY' }
      ]
    });

    // Tạo 1 phiên PENDING_ENTRY (xe quẹt thẻ tại cổng vào, chưa vào ô)
    const session = await prisma.parkingSession.create({
      data: {
        parkingLotId: testLotId,
        vehicleId,
        rfidCardId,
        status: ParkingSessionStatus.PENDING_ENTRY
      }
    });

    const res = await prisma.$transaction(async (tx) => {
      return AdmissionService.executeConservativeAdmission(tx, testLotId);
    });

    // 2 slots trống, 1 phiên PENDING_ENTRY -> còn đúng 1 suất
    expect(res.logicalOccupiedCount).toBe(1);
    expect(res.safeAvailableSpaces).toBe(1);

    // Dọn dẹp
    await prisma.parkingSession.delete({ where: { id: session.id } });
    await prisma.parkingSlot.deleteMany({ where: { parkingLotId: testLotId } });
  });

  it('ADM-03: Lệch số liệu: Xe lạ chiếm ô không quét thẻ (Ghost Vehicle) được xử lý bảo thủ', async () => {
    // 2 ô đỗ:
    // Slot 1: OCCUPIED (xe lạ chiếm)
    // Slot 2: EMPTY
    await prisma.parkingSlot.createMany({
      data: [
        { parkingLotId: testLotId, slotCode: 'C-01', operationalStatus: 'OCCUPIED', sensorStatus: 'OCCUPIED' },
        { parkingLotId: testLotId, slotCode: 'C-02', operationalStatus: 'AVAILABLE', sensorStatus: 'EMPTY' }
      ]
    });

    // Không có phiên logic nào (0 sessions)
    const res = await prisma.$transaction(async (tx) => {
      return AdmissionService.executeConservativeAdmission(tx, testLotId);
    });

    expect(res.logicalOccupiedCount).toBe(0);
    expect(res.physicalOccupiedCount).toBe(1);
    // physicalAvailable = 2 - max(1, 0) = 1.
    expect(res.safeAvailableSpaces).toBe(1);

    await prisma.parkingSlot.deleteMany({ where: { parkingLotId: testLotId } });
  });

  it('ADM-04: Từ chối tiếp nhận (PARKING_LOT_FULL) khi hết chỗ khả dụng', async () => {
    // Tạo 1 ô đỗ duy nhất và đã OCCUPIED
    await prisma.parkingSlot.create({
      data: {
        parkingLotId: testLotId,
        slotCode: 'D-01',
        operationalStatus: 'OCCUPIED',
        sensorStatus: 'OCCUPIED'
      }
    });

    await expect(
      prisma.$transaction(async (tx) => {
        return AdmissionService.executeConservativeAdmission(tx, testLotId);
      })
    ).rejects.toThrow('đã hết chỗ trống khả dụng');

    await prisma.parkingSlot.deleteMany({ where: { parkingLotId: testLotId } });
  });
});
