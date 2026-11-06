import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  PrismaClient,
  VehicleType,
  RfidCardStatus,
  ParkingSessionStatus,
  PaymentStatus,
  DeviceType,
  DeviceStatus,
  PricingType,
  EventProcessingStatus
} from '@prisma/client';

describe('Phase 1 Database Domain Modeling & Constraints Tests', () => {
  let prisma: PrismaClient;
  const testRunId = Date.now().toString(36);

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu kiểm thử theo thứ tự phụ thuộc khóa ngoại
    try {
      await prisma.deviceEvent.deleteMany({
        where: { eventId: { startsWith: `TEST_EVT_${testRunId}` } }
      });
      await prisma.parkingSession.deleteMany({
        where: { parkingLot: { name: { startsWith: `TEST_LOT_${testRunId}` } } }
      });
      await prisma.parkingSlot.deleteMany({
        where: { parkingLot: { name: { startsWith: `TEST_LOT_${testRunId}` } } }
      });
      await prisma.pricingRule.deleteMany({
        where: { parkingLot: { name: { startsWith: `TEST_LOT_${testRunId}` } } }
      });
      await prisma.device.deleteMany({
        where: { deviceCode: { startsWith: `TEST_DEV_${testRunId}` } }
      });
      await prisma.parkingLot.deleteMany({
        where: { name: { startsWith: `TEST_LOT_${testRunId}` } }
      });
      await prisma.rFIDCard.deleteMany({
        where: { uid: { startsWith: `TEST_UID_${testRunId}` } }
      });
      await prisma.vehicle.deleteMany({
        where: { licensePlate: { startsWith: `TEST_PLATE_${testRunId}` } }
      });
    } catch {
      // Bỏ qua lỗi cleanup nếu dữ liệu chưa tạo
    } finally {
      await prisma.$disconnect();
    }
  });

  // 1. Kiểm tra kết nối cơ sở dữ liệu
  it('1. Database connectivity should be alive and healthy', async () => {
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    expect(result).toBeDefined();
    expect(result[0]?.ok).toBe(1);
  });

  // 2. Tạo thực thể cơ bản (Entity Creation)
  it('2. Should successfully create ParkingLot, Vehicle, RFIDCard, Device, PricingRule', async () => {
    const lot = await prisma.parkingLot.create({
      data: {
        name: `TEST_LOT_${testRunId}_MAIN`,
        totalCapacity: 50,
        location: 'Tòa nhà A'
      }
    });
    expect(lot.id).toBeDefined();
    expect(lot.totalCapacity).toBe(50);

    const vehicle = await prisma.vehicle.create({
      data: {
        licensePlate: `TEST_PLATE_${testRunId}_01`,
        vehicleType: VehicleType.CAR
      }
    });
    expect(vehicle.id).toBeDefined();

    const rfid = await prisma.rFIDCard.create({
      data: {
        uid: `TEST_UID_${testRunId}_01`,
        vehicleId: vehicle.id,
        status: RfidCardStatus.ACTIVE
      }
    });
    expect(rfid.id).toBeDefined();
    expect(rfid.vehicleId).toBe(vehicle.id);

    const device = await prisma.device.create({
      data: {
        deviceCode: `TEST_DEV_${testRunId}_IN`,
        deviceType: DeviceType.GATE_ENTRY,
        parkingLotId: lot.id,
        status: DeviceStatus.ONLINE
      }
    });
    expect(device.id).toBeDefined();

    const pricing = await prisma.pricingRule.create({
      data: {
        parkingLotId: lot.id,
        vehicleType: VehicleType.CAR,
        pricingType: PricingType.PER_HOUR,
        amount: 20000
      }
    });
    expect(pricing.id).toBeDefined();
    expect(Number(pricing.amount)).toBe(20000);
  });

  // 3. Quan hệ thực thể (Entity Relationships)
  it('3. Should correctly traverse relations across models', async () => {
    const lot = await prisma.parkingLot.findFirst({
      where: { name: `TEST_LOT_${testRunId}_MAIN` },
      include: {
        devices: true,
        pricingRules: true
      }
    });

    expect(lot).toBeDefined();
    expect(lot!.devices.length).toBeGreaterThan(0);
    expect(lot!.pricingRules.length).toBeGreaterThan(0);
  });

  // 4. Ràng buộc duy nhất UID thẻ RFID (RFID UID uniqueness)
  it('4. Should reject duplicate RFID card UID', async () => {
    const duplicateUid = `TEST_UID_${testRunId}_UNIQUE`;
    await prisma.rFIDCard.create({
      data: { uid: duplicateUid, status: RfidCardStatus.ACTIVE }
    });

    // Cố tình tạo thẻ thứ hai với cùng UID
    await expect(
      prisma.rFIDCard.create({
        data: { uid: duplicateUid, status: RfidCardStatus.ACTIVE }
      })
    ).rejects.toThrow();
  });

  // 5. Ràng buộc duy nhất Biển số xe (Vehicle license plate uniqueness)
  it('5. Should reject duplicate vehicle license plate', async () => {
    const duplicatePlate = `TEST_PLATE_${testRunId}_UNIQUE`;
    await prisma.vehicle.create({
      data: { licensePlate: duplicatePlate, vehicleType: VehicleType.CAR }
    });

    // Cố tình tạo xe thứ hai cùng biển số
    await expect(
      prisma.vehicle.create({
        data: { licensePlate: duplicatePlate, vehicleType: VehicleType.MOTORBIKE }
      })
    ).rejects.toThrow();
  });

  // 6. Ràng buộc bất biến Event Idempotency (deviceId + eventId)
  it('6. Should enforce unique (deviceId, eventId) for IoT idempotent processing (IOT-01)', async () => {
    const device = await prisma.device.findFirst({
      where: { deviceCode: `TEST_DEV_${testRunId}_IN` }
    });

    const eventId = `TEST_EVT_${testRunId}_1001`;

    await prisma.deviceEvent.create({
      data: {
        eventId,
        deviceId: device!.id,
        eventType: 'RFID_SCANNED',
        payload: { cardUid: 'A1B2C3D4' },
        processingStatus: EventProcessingStatus.PROCESSED
      }
    });

    // Cố tình chèn lại sự kiện cùng deviceId và eventId
    await expect(
      prisma.deviceEvent.create({
        data: {
          eventId,
          deviceId: device!.id,
          eventType: 'RFID_SCANNED',
          payload: { cardUid: 'A1B2C3D4' },
          processingStatus: EventProcessingStatus.PENDING
        }
      })
    ).rejects.toThrow();
  });

  // 7. Toàn vẹn khóa ngoại & Bảo toàn dữ liệu lịch sử (onDelete: Restrict)
  it('7. Should prevent deleting a ParkingLot if it has dependent ParkingSessions', async () => {
    const lot = await prisma.parkingLot.create({
      data: {
        name: `TEST_LOT_${testRunId}_RESTRICT`,
        totalCapacity: 20
      }
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        licensePlate: `TEST_PLATE_${testRunId}_RESTRICT`,
        vehicleType: VehicleType.CAR
      }
    });
    const rfid = await prisma.rFIDCard.create({
      data: {
        uid: `TEST_UID_${testRunId}_RESTRICT`,
        status: RfidCardStatus.ACTIVE
      }
    });

    await prisma.parkingSession.create({
      data: {
        parkingLotId: lot.id,
        vehicleId: vehicle.id,
        rfidCardId: rfid.id,
        status: ParkingSessionStatus.COMPLETED,
        totalFee: 15000,
        paymentStatus: PaymentStatus.PAID
      }
    });

    // Xóa ParkingLot phải thất bại do ràng buộc onDelete: Restrict bảo toàn lịch sử
    await expect(
      prisma.parkingLot.delete({ where: { id: lot.id } })
    ).rejects.toThrow();
  });

  // 8. Ràng buộc PostgreSQL CHECK: Pricing amount không được âm
  it('8. Should enforce CHECK (amount >= 0) on pricing_rules', async () => {
    const lot = await prisma.parkingLot.findFirst({
      where: { name: `TEST_LOT_${testRunId}_MAIN` }
    });

    // Cố tình chèn trực tiếp mức giá âm vào cơ sở dữ liệu
    await expect(
      prisma.$executeRaw`
        INSERT INTO "pricing_rules" ("id", "parkingLotId", "vehicleType", "pricingType", "amount", "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${lot!.id}, 'CAR', 'PER_VISIT', -5000, true, NOW(), NOW())
      `
    ).rejects.toThrow(/chk_pricing_rule_amount_non_negative/i);
  });

  // 9. Ràng buộc PostgreSQL CHECK: ParkingSession totalFee không được âm
  it('9. Should enforce CHECK (totalFee >= 0) on parking_sessions', async () => {
    const lot = await prisma.parkingLot.findFirst({
      where: { name: `TEST_LOT_${testRunId}_MAIN` }
    });
    const vehicle = await prisma.vehicle.findFirst({
      where: { licensePlate: `TEST_PLATE_${testRunId}_01` }
    });
    const rfid = await prisma.rFIDCard.findFirst({
      where: { uid: `TEST_UID_${testRunId}_01` }
    });

    // Cố tình chèn phiên đỗ có totalFee âm
    await expect(
      prisma.$executeRaw`
        INSERT INTO "parking_sessions" ("id", "parkingLotId", "vehicleId", "rfidCardId", "entryTime", "status", "totalFee", "paymentStatus", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${lot!.id}, ${vehicle!.id}, ${rfid!.id}, NOW(), 'COMPLETED', -10000, 'UNPAID', NOW(), NOW())
      `
    ).rejects.toThrow(/chk_parking_session_total_fee_non_negative/i);
  });

  // 10. Chỉ mục điều kiện (Partial Unique Index): Không thể có 2 phiên ACTIVE cùng 1 xe
  it('10. Should reject second ACTIVE session for the same vehicle (Partial Unique Index)', async () => {
    const lot = await prisma.parkingLot.findFirst({
      where: { name: `TEST_LOT_${testRunId}_MAIN` }
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        licensePlate: `TEST_PLATE_${testRunId}_ACTIVE_CHK`,
        vehicleType: VehicleType.CAR
      }
    });
    const rfid1 = await prisma.rFIDCard.create({
      data: {
        uid: `TEST_UID_${testRunId}_ACTIVE_1`,
        status: RfidCardStatus.ACTIVE
      }
    });
    const rfid2 = await prisma.rFIDCard.create({
      data: {
        uid: `TEST_UID_${testRunId}_ACTIVE_2`,
        status: RfidCardStatus.ACTIVE
      }
    });

    // Phiên active thứ nhất: Thành công
    await prisma.parkingSession.create({
      data: {
        parkingLotId: lot!.id,
        vehicleId: vehicle.id,
        rfidCardId: rfid1.id,
        status: ParkingSessionStatus.ACTIVE
      }
    });

    // Cố tình tạo phiên active thứ hai cho cùng chiếc xe đó: Phải bị từ chối bởi partial unique index
    await expect(
      prisma.parkingSession.create({
        data: {
          parkingLotId: lot!.id,
          vehicleId: vehicle.id,
          rfidCardId: rfid2.id,
          status: ParkingSessionStatus.ACTIVE
        }
      })
    ).rejects.toThrow(/unique constraint/i);
  });

  // 11. Ràng buộc PostgreSQL CHECK (Phase 2): Cặp cảm biến sensorDeviceId & sensorChannel phải cùng NULL hoặc cùng NOT NULL
  it('11. Should enforce CHECK chk_parking_slot_sensor_mapping_pair on parking_slots', async () => {
    const lot = await prisma.parkingLot.findFirst({
      where: { name: `TEST_LOT_${testRunId}_MAIN` }
    });
    const dev = await prisma.device.findFirst({
      where: { deviceCode: `TEST_DEV_${testRunId}_IN` }
    });

    // Cố tình chèn sensorDeviceId nhưng sensorChannel = NULL
    await expect(
      prisma.$executeRaw`
        INSERT INTO "parking_slots" ("id", "parkingLotId", "slotCode", "sensorDeviceId", "sensorChannel", "sensorStatus", "operationalStatus", "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${lot!.id}, ${`SLOT_PAIR_FAIL_${testRunId}`}, ${dev!.id}, NULL, 'UNKNOWN', 'AVAILABLE', true, NOW(), NOW())
      `
    ).rejects.toThrow(/chk_parking_slot_sensor_mapping_pair/i);
  });

  // 12. Ràng buộc PostgreSQL CHECK (Phase 2): sensorChannel nếu có phải > 0
  it('12. Should enforce CHECK chk_parking_slot_sensor_channel_positive on parking_slots', async () => {
    const lot = await prisma.parkingLot.findFirst({
      where: { name: `TEST_LOT_${testRunId}_MAIN` }
    });
    const dev = await prisma.device.findFirst({
      where: { deviceCode: `TEST_DEV_${testRunId}_IN` }
    });

    // Cố tình chèn sensorChannel = 0 (kênh không hợp lệ)
    await expect(
      prisma.$executeRaw`
        INSERT INTO "parking_slots" ("id", "parkingLotId", "slotCode", "sensorDeviceId", "sensorChannel", "sensorStatus", "operationalStatus", "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${lot!.id}, ${`SLOT_CHAN_FAIL_${testRunId}`}, ${dev!.id}, 0, 'UNKNOWN', 'AVAILABLE', true, NOW(), NOW())
      `
    ).rejects.toThrow(/chk_parking_slot_sensor_channel_positive/i);
  });
});
