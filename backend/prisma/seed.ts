import {
  PrismaClient,
  VehicleType,
  RfidCardStatus,
  DeviceType,
  DeviceStatus,
  PricingType,
  SensorStatus,
  SlotOperationalStatus
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Script nạp dữ liệu mẫu phát triển (Development Seed Script).
 * Tuân thủ nguyên tắc:
 * 1. Đảm bảo tính lặp lại (Idempotency): Rerunning không tạo dữ liệu trùng lặp.
 * 2. Không sinh dữ liệu giả lập phiên đỗ xe (ParkingSession) đang hoạt động.
 * 3. Chỉ cung cấp các dữ liệu danh mục tĩnh cần thiết để khởi động hệ thống.
 * 4. Băm mật khẩu an toàn theo chuẩn bcrypt từ biến môi trường SEED_ADMIN_PASSWORD.
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

  // 4. Thẻ từ RFID mẫu (1 gán cho xe, 1 thẻ vãng lai/chưa gán)
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

