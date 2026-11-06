-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAR', 'MOTORBIKE');

-- CreateEnum
CREATE TYPE "RfidCardStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOST', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ParkingSessionStatus" AS ENUM ('PENDING_ENTRY', 'ACTIVE', 'PENDING_EXIT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'EXEMPT');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('GATE_ENTRY', 'GATE_EXIT', 'SENSOR_NODE');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "EventProcessingStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('PER_VISIT', 'PER_HOUR');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "parking_lots" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "totalCapacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parking_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'CAR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfid_cards" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "vehicleId" TEXT,
    "status" "RfidCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfid_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_sessions" (
    "id" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "rfidCardId" TEXT NOT NULL,
    "entryTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitTime" TIMESTAMP(3),
    "status" "ParkingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastSeen" TIMESTAMP(3),
    "ipAddress" TEXT,
    "firmwareVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processingStatus" "EventProcessingStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "device_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "pricingType" "PricingType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_licensePlate_key" ON "vehicles"("licensePlate");

-- CreateIndex
CREATE INDEX "vehicles_licensePlate_idx" ON "vehicles"("licensePlate");

-- CreateIndex
CREATE UNIQUE INDEX "rfid_cards_uid_key" ON "rfid_cards"("uid");

-- CreateIndex
CREATE INDEX "rfid_cards_uid_idx" ON "rfid_cards"("uid");

-- CreateIndex
CREATE INDEX "rfid_cards_vehicleId_idx" ON "rfid_cards"("vehicleId");

-- CreateIndex
CREATE INDEX "parking_sessions_status_idx" ON "parking_sessions"("status");

-- CreateIndex
CREATE INDEX "parking_sessions_entryTime_idx" ON "parking_sessions"("entryTime");

-- CreateIndex
CREATE INDEX "parking_sessions_parkingLotId_status_idx" ON "parking_sessions"("parkingLotId", "status");

-- CreateIndex
CREATE INDEX "parking_sessions_vehicleId_idx" ON "parking_sessions"("vehicleId");

-- CreateIndex
CREATE INDEX "parking_sessions_rfidCardId_idx" ON "parking_sessions"("rfidCardId");

-- CreateIndex
CREATE UNIQUE INDEX "devices_deviceCode_key" ON "devices"("deviceCode");

-- CreateIndex
CREATE INDEX "devices_parkingLotId_idx" ON "devices"("parkingLotId");

-- CreateIndex
CREATE INDEX "device_events_receivedAt_idx" ON "device_events"("receivedAt");

-- CreateIndex
CREATE INDEX "device_events_deviceId_eventType_idx" ON "device_events"("deviceId", "eventType");

-- CreateIndex
CREATE INDEX "device_events_processingStatus_idx" ON "device_events"("processingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "device_events_deviceId_eventId_key" ON "device_events"("deviceId", "eventId");

-- CreateIndex
CREATE INDEX "pricing_rules_parkingLotId_idx" ON "pricing_rules"("parkingLotId");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_rules_parkingLotId_vehicleType_pricingType_key" ON "pricing_rules"("parkingLotId", "vehicleType", "pricingType");

-- AddForeignKey
ALTER TABLE "rfid_cards" ADD CONSTRAINT "rfid_cards_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "parking_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_rfidCardId_fkey" FOREIGN KEY ("rfidCardId") REFERENCES "rfid_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "parking_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "parking_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==============================================================================
-- POSTGRESQL ADVANCED BUSINESS CONSTRAINTS & PARTIAL INDEXES (PHASE 1)
-- ==============================================================================

-- 1. Ràng buộc bất biến: Phí gửi xe không được phép âm (>= 0)
ALTER TABLE "parking_sessions" ADD CONSTRAINT "chk_parking_session_total_fee_non_negative" CHECK ("totalFee" >= 0);

-- 2. Ràng buộc bất biến: Mức phí cấu hình không được phép âm (>= 0)
ALTER TABLE "pricing_rules" ADD CONSTRAINT "chk_pricing_rule_amount_non_negative" CHECK ("amount" >= 0);

-- 3. Chỉ mục duy nhất có điều kiện (Partial Unique Index):
-- Ngăn chặn cùng 1 phương tiện có nhiều hơn 1 phiên gửi xe đang hoạt động đồng thời (ACTIVE, PENDING_ENTRY, PENDING_EXIT)
CREATE UNIQUE INDEX "unique_active_vehicle_session" ON "parking_sessions" ("vehicleId") WHERE "status" IN ('ACTIVE', 'PENDING_ENTRY', 'PENDING_EXIT');

-- 4. Chỉ mục duy nhất có điều kiện cho thẻ RFID:
-- Ngăn chặn cùng 1 thẻ từ RFID có nhiều hơn 1 phiên gửi xe đang hoạt động đồng thời
CREATE UNIQUE INDEX "unique_active_rfid_session" ON "parking_sessions" ("rfidCardId") WHERE "status" IN ('ACTIVE', 'PENDING_ENTRY', 'PENDING_EXIT');

