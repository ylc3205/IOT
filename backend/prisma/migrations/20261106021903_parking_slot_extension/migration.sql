-- CreateEnum
CREATE TYPE "SensorStatus" AS ENUM ('EMPTY', 'OCCUPIED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SlotOperationalStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "parking_slots" (
    "id" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "slotCode" TEXT NOT NULL,
    "sensorDeviceId" TEXT,
    "sensorChannel" INTEGER,
    "sensorStatus" "SensorStatus" NOT NULL DEFAULT 'UNKNOWN',
    "operationalStatus" "SlotOperationalStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSensorUpdate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parking_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parking_slots_parkingLotId_operationalStatus_idx" ON "parking_slots"("parkingLotId", "operationalStatus");

-- CreateIndex
CREATE INDEX "parking_slots_sensorStatus_idx" ON "parking_slots"("sensorStatus");

-- CreateIndex
CREATE UNIQUE INDEX "parking_slots_parkingLotId_slotCode_key" ON "parking_slots"("parkingLotId", "slotCode");

-- CreateIndex
CREATE UNIQUE INDEX "parking_slots_sensorDeviceId_sensorChannel_key" ON "parking_slots"("sensorDeviceId", "sensorChannel");

-- AddForeignKey
ALTER TABLE "parking_slots" ADD CONSTRAINT "parking_slots_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "parking_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_slots" ADD CONSTRAINT "parking_slots_sensorDeviceId_fkey" FOREIGN KEY ("sensorDeviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================================================================
-- POSTGRESQL ADVANCED BUSINESS CONSTRAINTS (PHASE 2 PARKING SLOT EXTENSION)
-- ==============================================================================

-- 1. Ràng buộc cặp đồng bộ cảm biến:
-- Thiết bị cảm biến và Kênh cảm biến phải cùng NULL (chưa gắn cảm biến)
-- hoặc cùng NOT NULL (đã xác định rõ Node và Kênh cổng IO trên ESP32).
ALTER TABLE "parking_slots" ADD CONSTRAINT "chk_parking_slot_sensor_mapping_pair"
  CHECK (("sensorDeviceId" IS NULL AND "sensorChannel" IS NULL) OR ("sensorDeviceId" IS NOT NULL AND "sensorChannel" IS NOT NULL));

-- 2. Ràng buộc kênh cảm biến:
-- Kênh cảm biến (sensorChannel) nếu được khai báo phải là số nguyên dương (> 0).
ALTER TABLE "parking_slots" ADD CONSTRAINT "chk_parking_slot_sensor_channel_positive"
  CHECK ("sensorChannel" IS NULL OR "sensorChannel" > 0);

