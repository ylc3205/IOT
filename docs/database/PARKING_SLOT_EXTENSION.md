# SMART PARKING IOT — PARKING SLOT DATABASE EXTENSION (PHASE 2)

## 1. TỔNG QUAN (OVERVIEW)

Trong Pha 2, thực thể `ParkingSlot` (từng vị trí đỗ xe riêng lẻ) được tích hợp vào cơ sở dữ liệu PostgreSQL thông qua Prisma ORM. Mở rộng này đáp ứng nhu cầu quản lý chi tiết từng ô đỗ xe, liên kết trạng thái cảm biến vật lý phần cứng IoT (ESP32 Sensor Node) và cung cấp dữ liệu tức thời cho báo cáo độ lấp đầy (Occupancy Metrics) của CMS.

---

## 2. THIẾT KẾ LƯỢC ĐỒ (SCHEMA DESIGN)

### 2.1 Các kiểu liệt kê (Enums)

```prisma
/// Trạng thái cảm biến vật lý tại vị trí đỗ
enum SensorStatus {
  EMPTY    // Vị trí đỗ đang trống
  OCCUPIED // Có phương tiện đang đỗ trên vị trí
  UNKNOWN  // Chưa xác định được (mất kết nối cảm biến hoặc chưa đồng bộ)
}

/// Trạng thái vận hành của vị trí đỗ xe
enum SlotOperationalStatus {
  AVAILABLE   // Sẵn sàng tiếp nhận xe
  OCCUPIED    // Đang có xe đỗ
  MAINTENANCE // Đang bảo trì, tạm khóa vị trí
}
```

### 2.2 Thực thể `ParkingSlot`

```prisma
model ParkingSlot {
  id                String                @id @default(uuid())
  parkingLotId      String
  slotCode          String                // Mã định danh vị trí đỗ (VD: A-01, B-02)
  sensorDeviceId    String?               // Thiết bị cảm biến gắn với vị trí (nếu có)
  sensorChannel     Int?                  // Kênh cảm biến trên board ESP32 (1, 2, ...)
  sensorStatus      SensorStatus          @default(UNKNOWN)
  operationalStatus SlotOperationalStatus @default(AVAILABLE)
  isActive          Boolean               @default(true)
  lastSensorUpdate  DateTime?             // Thời điểm cập nhật trạng thái cảm biến gần nhất
  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt

  parkingLot   ParkingLot @relation(fields: [parkingLotId], references: [id], onDelete: Restrict)
  sensorDevice Device?    @relation(fields: [sensorDeviceId], references: [id], onDelete: SetNull)

  @@unique([parkingLotId, slotCode])
  @@unique([sensorDeviceId, sensorChannel])
  @@index([parkingLotId, operationalStatus])
  @@index([sensorStatus])
  @@map("parking_slots")
}
```

---

## 3. RÀNG BUỘC TOÀN VẸN CƠ SỞ DỮ LIỆU (DATABASE CONSTRAINTS)

Để bảo đảm tính toàn vẹn dữ liệu ở cấp độ động cơ lưu trữ PostgreSQL, migration `20261106021903_parking_slot_extension` bổ sung các ràng buộc nâng cao:

1. **Ràng buộc cặp đồng bộ cảm biến (`chk_parking_slot_sensor_mapping_pair`)**:
   ```sql
   ALTER TABLE "parking_slots" ADD CONSTRAINT "chk_parking_slot_sensor_mapping_pair"
     CHECK (("sensorDeviceId" IS NULL AND "sensorChannel" IS NULL) OR ("sensorDeviceId" IS NOT NULL AND "sensorChannel" IS NOT NULL));
   ```
   *Ý nghĩa kỹ thuật*: Ngăn chặn trạng thái dữ liệu không nhất quán: không thể khai báo thiết bị mà bỏ trống kênh, hoặc khai báo kênh mà không gán vào thiết bị nào.

2. **Ràng buộc kênh cảm biến dương (`chk_parking_slot_sensor_channel_positive`)**:
   ```sql
   ALTER TABLE "parking_slots" ADD CONSTRAINT "chk_parking_slot_sensor_channel_positive"
     CHECK ("sensorChannel" IS NULL OR "sensorChannel" > 0);
   ```
   *Ý nghĩa kỹ thuật*: Kênh cảm biến vật lý trên vi điều khiển ESP32 bắt buộc phải là số nguyên dương ($1, 2, 3, \dots$).

3. **Chỉ mục duy nhất theo cặp thiết bị & kênh (`parking_slots_sensorDeviceId_sensorChannel_key`)**:
   - Ngăn chặn việc cấu hình 2 vị trí đỗ khác nhau sử dụng chung 1 kênh cảm biến trên cùng 1 node phần cứng.

4. **Chỉ mục duy nhất theo bãi đỗ & mã vị trí (`parking_slots_parkingLotId_slotCode_key`)**:
   - Đảm bảo trong cùng 1 bãi xe, không thể có 2 ô đỗ trùng mã code (VD: chỉ có một vị trí `A-01` trong `Khu A`).

---

## 4. QUY TẮC BẢO TOÀN KIẾN TRÚC

- **Không gắn trực tiếp với `ParkingSession`**: Thực thể `ParkingSlot` độc lập hoàn toàn với `ParkingSession`. Phiên gửi xe ghi nhận phương tiện ra vào cổng kiểm soát, trong khi `ParkingSlot` quản lý không gian đỗ tĩnh.
- **Bảo toàn tính toàn vẹn khóa ngoại**:
  - `parkingLot`: `onDelete: Restrict` (không thể xóa bãi xe nếu đang có các slot được cấu hình).
  - `sensorDevice`: `onDelete: SetNull` (nếu thiết bị cảm biến bị tháo gỡ hoặc bảo trì, slot không bị xóa mà chỉ đưa về trạng thái chưa gán cảm biến).

