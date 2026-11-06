import {
  PrismaClient,
  VehicleType,
  RfidCardStatus,
  DeviceType,
  DeviceStatus,
  PricingType,
  SensorStatus,
  SlotOperationalStatus,
  ParkingSessionStatus,
  PaymentStatus
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Script nạp dữ liệu mẫu phát triển (Development Seed Script).
 * Tuân thủ nguyên tắc:
 * 1. Đảm bảo tính lặp lại (Idempotency): Rerunning không tạo dữ liệu trùng lặp.
 * 2. Cung cấp dữ liệu danh mục tĩnh và các phiên gửi xe mẫu phục vụ kiểm thử CMS Phase 3.
 * 3. Băm mật khẩu an toàn theo chuẩn bcrypt từ biến môi trường SEED_ADMIN_PASSWORD.
 */
async function main() {
  console.log('🌱 Bắt đầu nạp dữ liệu mẫu (Seeding development data)...');

  // 1. Tài khoản Operator / Admin CMS mẫu (Mật khẩu chuẩn hóa mã hóa bcrypt)
  const rawAdminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
  const hashedPassword = await bcrypt.hash(rawAdminPassword, 10);

  const user = await prisma.user.upsert({
    where: { email: 'operator@smartparking.local' },
    update: {
      fullName: 'Nhân viên Trực cổng',
      role: 'OPERATOR',
      passwordHash: hashedPassword,
      isActive: true
    },
    create: {
      email: 'operator@smartparking.local',
      fullName: 'Nhân viên Trực cổng',
      role: 'OPERATOR',
      passwordHash: hashedPassword,
      isActive: true
    }
  });
  console.log(`✅ [User] ${user.email} (${user.role}) - Mật khẩu đã mã hóa bcrypt`);

  // 2. Bãi đỗ xe mẫu (MVP: 1 bãi xe chính)
  const parkingLot = await prisma.parkingLot.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {
      name: 'Bãi Đỗ Xe Đại Học - Khu A',
      location: 'Khu A, Tòa nhà Trung tâm Công nghệ',
      totalCapacity: 100,
      isActive: true
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Bãi Đỗ Xe Đại Học - Khu A',
      location: 'Khu A, Tòa nhà Trung tâm Công nghệ',
      totalCapacity: 100,
      isActive: true
    }
  });
  console.log(`✅ [ParkingLot] ${parkingLot.name} (Sức chứa: ${parkingLot.totalCapacity})`);

  // 3. Phương tiện mẫu (1 Ô tô, 1 Xe máy)
  const car = await prisma.vehicle.upsert({
    where: { licensePlate: '51A-12345' },
    update: {
      vehicleType: VehicleType.CAR,
      isActive: true
    },
    create: {
      licensePlate: '51A-12345',
      vehicleType: VehicleType.CAR,
      isActive: true
    }
  });
  console.log(`✅ [Vehicle] ${car.licensePlate} (${car.vehicleType})`);

  const motorbike = await prisma.vehicle.upsert({
    where: { licensePlate: '59B1-98765' },
    update: {
      vehicleType: VehicleType.MOTORBIKE,
      isActive: true
    },
    create: {
      licensePlate: '59B1-98765',
      vehicleType: VehicleType.MOTORBIKE,
      isActive: true
    }
  });
  console.log(`✅ [Vehicle] ${motorbike.licensePlate} (${motorbike.vehicleType})`);

  const car2 = await prisma.vehicle.upsert({
    where: { licensePlate: '51G-88888' },
    update: {
      vehicleType: VehicleType.CAR,
      isActive: true
    },
    create: {
      licensePlate: '51G-88888',
      vehicleType: VehicleType.CAR,
      isActive: true
    }
  });
  console.log(`✅ [Vehicle] ${car2.licensePlate} (${car2.vehicleType})`);

  // 4. Thẻ từ RFID mẫu (gán cho xe và thẻ vãng lai)
  const rfid1 = await prisma.rFIDCard.upsert({
    where: { uid: 'E20000190600' },
    update: {
      vehicleId: car.id,
      status: RfidCardStatus.ACTIVE
    },
    create: {
      uid: 'E20000190600',
      vehicleId: car.id,
      status: RfidCardStatus.ACTIVE
    }
  });
  console.log(`✅ [RFIDCard] UID: ${rfid1.uid} -> Gán xe: ${car.licensePlate}`);

  const rfid2 = await prisma.rFIDCard.upsert({
    where: { uid: 'E20000190601' },
    update: {
      vehicleId: motorbike.id,
      status: RfidCardStatus.ACTIVE
    },
    create: {
      uid: 'E20000190601',
      vehicleId: motorbike.id,
      status: RfidCardStatus.ACTIVE
    }
  });
  console.log(`✅ [RFIDCard] UID: ${rfid2.uid} -> Gán xe: ${motorbike.licensePlate}`);

  const rfid3 = await prisma.rFIDCard.upsert({
    where: { uid: 'E20000190603' },
    update: {
      vehicleId: car2.id,
      status: RfidCardStatus.ACTIVE
    },
    create: {
      uid: 'E20000190603',
      vehicleId: car2.id,
      status: RfidCardStatus.ACTIVE
    }
  });
  console.log(`✅ [RFIDCard] UID: ${rfid3.uid} -> Gán xe: ${car2.licensePlate}`);

  const rfidVisitor = await prisma.rFIDCard.upsert({
    where: { uid: 'E20000190602' },
    update: {
      vehicleId: null,
      status: RfidCardStatus.ACTIVE
    },
    create: {
      uid: 'E20000190602',
      vehicleId: null,
      status: RfidCardStatus.ACTIVE
    }
  });
  console.log(`✅ [RFIDCard] UID: ${rfidVisitor.uid} (Thẻ vãng lai chưa gán trước)`);

  // 5. Cấu hình biểu giá gửi xe mẫu (Pricing Rules)
  // Ô tô tính theo giờ (15,000 VND / giờ)
  const carPricing = await prisma.pricingRule.upsert({
    where: {
      parkingLotId_vehicleType_pricingType: {
        parkingLotId: parkingLot.id,
        vehicleType: VehicleType.CAR,
        pricingType: PricingType.PER_HOUR
      }
    },
    update: {
      amount: 15000,
      isActive: true
    },
    create: {
      parkingLotId: parkingLot.id,
      vehicleType: VehicleType.CAR,
      pricingType: PricingType.PER_HOUR,
      amount: 15000,
      isActive: true
    }
  });
  console.log(`✅ [PricingRule] ${carPricing.vehicleType} - ${carPricing.pricingType}: ${carPricing.amount} VND`);

  // Xe máy tính theo lượt (5,000 VND / lượt)
  const motoPricing = await prisma.pricingRule.upsert({
    where: {
      parkingLotId_vehicleType_pricingType: {
        parkingLotId: parkingLot.id,
        vehicleType: VehicleType.MOTORBIKE,
        pricingType: PricingType.PER_VISIT
      }
    },
    update: {
      amount: 5000,
      isActive: true
    },
    create: {
      parkingLotId: parkingLot.id,
      vehicleType: VehicleType.MOTORBIKE,
      pricingType: PricingType.PER_VISIT,
      amount: 5000,
      isActive: true
    }
  });
  console.log(`✅ [PricingRule] ${motoPricing.vehicleType} - ${motoPricing.pricingType}: ${motoPricing.amount} VND`);

  // 6. Thiết bị biên IoT mẫu (ESP32 Gate Node tại cổng vào & Sensor Node đo vị trí)
  const gateDevice = await prisma.device.upsert({
    where: { deviceCode: 'GATE_IN_01' },
    update: {
      parkingLotId: parkingLot.id,
      deviceType: DeviceType.GATE_ENTRY,
      status: DeviceStatus.ONLINE,
      firmwareVersion: '1.0.0-esp32',
      ipAddress: '192.168.1.101',
      lastSeen: new Date()
    },
    create: {
      deviceCode: 'GATE_IN_01',
      parkingLotId: parkingLot.id,
      deviceType: DeviceType.GATE_ENTRY,
      status: DeviceStatus.ONLINE,
      firmwareVersion: '1.0.0-esp32',
      ipAddress: '192.168.1.101',
      lastSeen: new Date()
    }
  });
  console.log(`✅ [Device] ${gateDevice.deviceCode} (${gateDevice.deviceType}) - Status: ${gateDevice.status}`);

  const sensorNode = await prisma.device.upsert({
    where: { deviceCode: 'SENSOR_NODE_01' },
    update: {
      parkingLotId: parkingLot.id,
      deviceType: DeviceType.SENSOR_NODE,
      status: DeviceStatus.ONLINE,
      firmwareVersion: '1.0.0-sensor',
      ipAddress: '192.168.1.102',
      lastSeen: new Date()
    },
    create: {
      deviceCode: 'SENSOR_NODE_01',
      parkingLotId: parkingLot.id,
      deviceType: DeviceType.SENSOR_NODE,
      status: DeviceStatus.ONLINE,
      firmwareVersion: '1.0.0-sensor',
      ipAddress: '192.168.1.102',
      lastSeen: new Date()
    }
  });
  console.log(`✅ [Device] ${sensorNode.deviceCode} (${sensorNode.deviceType}) - Status: ${sensorNode.status}`);

  // 7. Vị trí đỗ xe mẫu (Parking Slots - Phase 2 Extension)
  const slotA1 = await prisma.parkingSlot.upsert({
    where: {
      parkingLotId_slotCode: {
        parkingLotId: parkingLot.id,
        slotCode: 'A-01'
      }
    },
    update: {
      sensorStatus: SensorStatus.EMPTY,
      operationalStatus: SlotOperationalStatus.AVAILABLE,
      isActive: true
    },
    create: {
      parkingLotId: parkingLot.id,
      slotCode: 'A-01',
      sensorStatus: SensorStatus.EMPTY,
      operationalStatus: SlotOperationalStatus.AVAILABLE,
      isActive: true
    }
  });
  console.log(`✅ [ParkingSlot] Slot: ${slotA1.slotCode} - OpStatus: ${slotA1.operationalStatus}`);

  const slotA2 = await prisma.parkingSlot.upsert({
    where: {
      parkingLotId_slotCode: {
        parkingLotId: parkingLot.id,
        slotCode: 'A-02'
      }
    },
    update: {
      sensorStatus: SensorStatus.EMPTY,
      operationalStatus: SlotOperationalStatus.AVAILABLE,
      isActive: true
    },
    create: {
      parkingLotId: parkingLot.id,
      slotCode: 'A-02',
      sensorStatus: SensorStatus.EMPTY,
      operationalStatus: SlotOperationalStatus.AVAILABLE,
      isActive: true
    }
  });
  console.log(`✅ [ParkingSlot] Slot: ${slotA2.slotCode} - OpStatus: ${slotA2.operationalStatus}`);

  const slotA3 = await prisma.parkingSlot.upsert({
    where: {
      parkingLotId_slotCode: {
        parkingLotId: parkingLot.id,
        slotCode: 'A-03'
      }
    },
    update: {
      sensorStatus: SensorStatus.UNKNOWN,
      operationalStatus: SlotOperationalStatus.MAINTENANCE,
      isActive: true
    },
    create: {
      parkingLotId: parkingLot.id,
      slotCode: 'A-03',
      sensorStatus: SensorStatus.UNKNOWN,
      operationalStatus: SlotOperationalStatus.MAINTENANCE,
      isActive: true
    }
  });
  console.log(`✅ [ParkingSlot] Slot: ${slotA3.slotCode} - OpStatus: ${slotA3.operationalStatus}`);

  const slotB1 = await prisma.parkingSlot.upsert({
    where: {
      parkingLotId_slotCode: {
        parkingLotId: parkingLot.id,
        slotCode: 'B-01'
      }
    },
    update: {
      sensorDeviceId: sensorNode.id,
      sensorChannel: 1,
      sensorStatus: SensorStatus.EMPTY,
      operationalStatus: SlotOperationalStatus.AVAILABLE,
      isActive: true
    },
    create: {
      parkingLotId: parkingLot.id,
      slotCode: 'B-01',
      sensorDeviceId: sensorNode.id,
      sensorChannel: 1,
      sensorStatus: SensorStatus.EMPTY,
      operationalStatus: SlotOperationalStatus.AVAILABLE,
      isActive: true
    }
  });
  console.log(`✅ [ParkingSlot] Slot: ${slotB1.slotCode} -> Cảm biến: ${sensorNode.deviceCode} (Kênh: 1)`);

  // 8. Phiên gửi xe mẫu phục vụ kiểm thử và demo CMS (Parking Sessions - Phase 3)
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const threeHoursAgo = new Date(now.getTime() - 180 * 60 * 1000);
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const yesterdayEntry = new Date(now.getTime() - 26 * 60 * 60 * 1000);
  const yesterdayExit = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 8.1 Phiên đã hoàn tất (COMPLETED)
  const completedSession = await prisma.parkingSession.upsert({
    where: { id: '10000000-0000-0000-0000-000000000001' },
    update: {
      parkingLotId: parkingLot.id,
      vehicleId: car.id,
      rfidCardId: rfid1.id,
      entryTime: yesterdayEntry,
      exitTime: yesterdayExit,
      status: ParkingSessionStatus.COMPLETED,
      pricingRuleId: carPricing.id,
      pricingType: PricingType.PER_HOUR,
      pricingRate: 15000,
      billingCutoffTime: yesterdayExit,
      durationMinutes: 120,
      billableHours: 2,
      totalFee: 30000,
      paidAmount: 30000,
      paymentStatus: PaymentStatus.PAID,
      paymentTime: yesterdayExit,
      paymentOperatorId: user.id,
      isManualExit: true,
      manualExitReason: 'Rời bãi thông thường qua xác nhận nhân viên',
      manualExitOperatorId: user.id
    },
    create: {
      id: '10000000-0000-0000-0000-000000000001',
      parkingLotId: parkingLot.id,
      vehicleId: car.id,
      rfidCardId: rfid1.id,
      entryTime: yesterdayEntry,
      exitTime: yesterdayExit,
      status: ParkingSessionStatus.COMPLETED,
      pricingRuleId: carPricing.id,
      pricingType: PricingType.PER_HOUR,
      pricingRate: 15000,
      billingCutoffTime: yesterdayExit,
      durationMinutes: 120,
      billableHours: 2,
      totalFee: 30000,
      paidAmount: 30000,
      paymentStatus: PaymentStatus.PAID,
      paymentTime: yesterdayExit,
      paymentOperatorId: user.id,
      isManualExit: true,
      manualExitReason: 'Rời bãi thông thường qua xác nhận nhân viên',
      manualExitOperatorId: user.id
    }
  });

  await prisma.parkingSessionPayment.upsert({
    where: { id: '20000000-0000-0000-0000-000000000001' },
    update: {
      sessionId: completedSession.id,
      amount: 30000,
      paymentTime: yesterdayExit,
      operatorId: user.id,
      paymentType: 'CASH',
      note: 'INITIAL_PAYMENT'
    },
    create: {
      id: '20000000-0000-0000-0000-000000000001',
      sessionId: completedSession.id,
      amount: 30000,
      paymentTime: yesterdayExit,
      operatorId: user.id,
      paymentType: 'CASH',
      note: 'INITIAL_PAYMENT'
    }
  });
  console.log(`✅ [ParkingSession] COMPLETED: ${completedSession.id} (${car.licensePlate}) - Thu: 30,000 VND`);

  // 8.2 Phiên đang trong bãi (ACTIVE)
  const activeSession = await prisma.parkingSession.upsert({
    where: { id: '10000000-0000-0000-0000-000000000002' },
    update: {
      parkingLotId: parkingLot.id,
      vehicleId: motorbike.id,
      rfidCardId: rfid2.id,
      entryTime: oneHourAgo,
      exitTime: null,
      status: ParkingSessionStatus.ACTIVE,
      pricingRuleId: motoPricing.id,
      pricingType: PricingType.PER_VISIT,
      pricingRate: 5000,
      totalFee: 0,
      paidAmount: 0,
      paymentStatus: PaymentStatus.UNPAID
    },
    create: {
      id: '10000000-0000-0000-0000-000000000002',
      parkingLotId: parkingLot.id,
      vehicleId: motorbike.id,
      rfidCardId: rfid2.id,
      entryTime: oneHourAgo,
      exitTime: null,
      status: ParkingSessionStatus.ACTIVE,
      pricingRuleId: motoPricing.id,
      pricingType: PricingType.PER_VISIT,
      pricingRate: 5000,
      totalFee: 0,
      paidAmount: 0,
      paymentStatus: PaymentStatus.UNPAID
    }
  });
  console.log(`✅ [ParkingSession] ACTIVE: ${activeSession.id} (${motorbike.licensePlate})`);

  // 8.3 Phiên đã thanh toán chờ ra (PENDING_EXIT trong grace period)
  const pendingExitSession = await prisma.parkingSession.upsert({
    where: { id: '10000000-0000-0000-0000-000000000003' },
    update: {
      parkingLotId: parkingLot.id,
      vehicleId: car2.id,
      rfidCardId: rfid3.id,
      entryTime: threeHoursAgo,
      exitTime: null,
      status: ParkingSessionStatus.PENDING_EXIT,
      pricingRuleId: carPricing.id,
      pricingType: PricingType.PER_HOUR,
      pricingRate: 15000,
      billingCutoffTime: fiveMinutesAgo,
      durationMinutes: 175,
      billableHours: 3,
      totalFee: 45000,
      paidAmount: 45000,
      paymentStatus: PaymentStatus.PAID,
      paymentTime: fiveMinutesAgo,
      paymentOperatorId: user.id
    },
    create: {
      id: '10000000-0000-0000-0000-000000000003',
      parkingLotId: parkingLot.id,
      vehicleId: car2.id,
      rfidCardId: rfid3.id,
      entryTime: threeHoursAgo,
      exitTime: null,
      status: ParkingSessionStatus.PENDING_EXIT,
      pricingRuleId: carPricing.id,
      pricingType: PricingType.PER_HOUR,
      pricingRate: 15000,
      billingCutoffTime: fiveMinutesAgo,
      durationMinutes: 175,
      billableHours: 3,
      totalFee: 45000,
      paidAmount: 45000,
      paymentStatus: PaymentStatus.PAID,
      paymentTime: fiveMinutesAgo,
      paymentOperatorId: user.id
    }
  });

  await prisma.parkingSessionPayment.upsert({
    where: { id: '20000000-0000-0000-0000-000000000002' },
    update: {
      sessionId: pendingExitSession.id,
      amount: 45000,
      paymentTime: fiveMinutesAgo,
      operatorId: user.id,
      paymentType: 'CASH',
      note: 'INITIAL_PAYMENT'
    },
    create: {
      id: '20000000-0000-0000-0000-000000000002',
      sessionId: pendingExitSession.id,
      amount: 45000,
      paymentTime: fiveMinutesAgo,
      operatorId: user.id,
      paymentType: 'CASH',
      note: 'INITIAL_PAYMENT'
    }
  });
  console.log(`✅ [ParkingSession] PENDING_EXIT: ${pendingExitSession.id} (${car2.licensePlate}) - Đã thu: 45,000 VND`);

  console.log('🎉 Nạp dữ liệu mẫu hoàn tất thành công!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi nạp dữ liệu seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

