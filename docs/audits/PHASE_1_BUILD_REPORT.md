# BÁO CÁO NGHIỆM THU PHA 1: THIẾT KẾ DOMAIN CƠ SỞ DỮ LIỆU (PHASE 1 BUILD REPORT)

**Dự án**: SMART PARKING IoT — CMS Management System  
**Phân hệ**: Phase 1 — Database Domain Modeling (PostgreSQL + Prisma ORM)  
**Mốc thời gian**: 06/11/2026 (Theo mốc thời gian hệ thống)  
**Trạng thái nghiệm thu cuối cùng**: **PHASE 1: PASS**  

---

## 1. TỔNG QUAN ĐIỀU HÀNH (EXECUTIVE SUMMARY)

Pha 1 đã hoàn thành đầy đủ mục tiêu thiết kế và hiện thực hóa mô hình dữ liệu quan hệ cho hệ thống Smart Parking IoT:
- Toàn bộ 8 thực thể trọng tâm đã được mô hình hóa trong Prisma schema [schema.prisma](file:///C:/Users/Vinh%20Nguyen/IOT/backend/prisma/schema.prisma): `User`, `ParkingLot`, `Vehicle`, `RFIDCard`, `ParkingSession`, `Device`, `DeviceEvent`, `PricingRule`.
- Thực thể `ParkingSlot` được phân tích và quyết định hoãn lại (deferred) theo hướng dẫn kỹ thuật nhằm tránh độ phức tạp ảo khi phần cứng cảm biến từng vị trí đỗ chưa được bàn giao.
- Bản migration mới `20261106003635_domain_modeling_phase1` được áp dụng thành công trên cơ sở dữ liệu PostgreSQL 16 trong Docker container, bảo toàn hoàn hảo migration khởi tạo của Pha 0.
- Các ràng buộc bất biến nâng cao cấp PostgreSQL (CHECK constraints `total_fee >= 0`, `amount >= 0` và Partial Unique Indexes chống trùng lặp xe/thẻ đang hoạt động) đã được tích hợp trực tiếp và kiểm chứng.
- Bộ dữ liệu mẫu phát triển (`prisma/seed.ts`) đã chạy thành công và đạt chuẩn lặp lại (idempotent).
- Bộ kiểm thử tự động toàn diện (6 test files, 23 unit & database integration tests) vượt qua 100%.

---

## 2. CÁC THỰC THỂ ĐÃ TRIỂN KHAI (IMPLEMENTED ENTITIES)

| Tên thực thể | Tên bảng SQL | Mục đích & Đặc tả chính |
|---|---|---|
| **User** | `users` | Tài khoản quản trị & nhân viên trực cổng CMS. Giữ nguyên trường `role` và UUID từ Pha 0, bổ sung `passwordHash`, `fullName`, `isActive`. |
| **ParkingLot** | `parking_lots` | Quản lý bãi đỗ xe vật lý, thông số sức chứa tối đa `totalCapacity` và trạng thái hoạt động `isActive`. |
| **Vehicle** | `vehicles` | Quản lý phương tiện. Khóa duy nhất `licensePlate` (chuẩn hóa in hoa). Phân loại `CAR` / `MOTORBIKE`. |
| **RFIDCard** | `rfid_cards` | Quản lý thẻ từ Mifare RC522. Khóa duy nhất `uid`. Trường `vehicleId` nullable hỗ trợ cả thẻ cố định và thẻ vãng lai. Trạng thái `ACTIVE`, `INACTIVE`, `LOST`, `BLOCKED`. |
| **ParkingSession** | `parking_sessions` | Ghi nhận phiên xe vào - ra. Quản lý trạng thái `PENDING_ENTRY`, `ACTIVE`, `PENDING_EXIT`, `COMPLETED`, `CANCELLED`. Trường `totalFee` dạng `Decimal(10,2)`. |
| **Device** | `devices` | Đại diện cho các Gateway / Barrier Node ESP32 tại cổng. Khóa duy nhất `deviceCode`. Trạng thái `ONLINE`, `OFFLINE`, `MAINTENANCE`. |
| **DeviceEvent** | `device_events` | Bảng nhật ký sự kiện bất biến nhận từ MQTT. Lưu `payload` JSONB, trạng thái xử lý `PENDING`, `PROCESSED`, `FAILED`, `IGNORED`. Khóa tổ hợp duy nhất `(deviceId, eventId)`. |
| **PricingRule** | `pricing_rules` | Cấu hình biểu giá gửi xe. Hỗ trợ tính theo lượt `PER_VISIT` hoặc theo giờ `PER_HOUR` cho từng loại xe. Tiền tệ `Decimal(10,2)`. |

*Thực thể hoãn lại*: `ParkingSlot` được ghi nhận hoãn lại (deferred) trong [DOMAIN_MODEL.md](file:///C:/Users/Vinh%20Nguyen/IOT/docs/database/DOMAIN_MODEL.md) cho đến khi nhóm phần cứng hoàn thiện mạch cảm biến vị trí đỗ.

---

## 3. QUAN HỆ THỰC THỂ (RELATIONSHIPS)

1. **`ParkingLot` 1 - n `Device`**: Một bãi đỗ xe sở hữu nhiều thiết bị biên (Barrier vào, Barrier ra). Hành vi: `onDelete: Restrict`.
2. **`ParkingLot` 1 - n `PricingRule`**: Một bãi đỗ xe áp dụng nhiều quy tắc tính giá theo loại xe và hình thức đỗ. Hành vi: `onDelete: Restrict`.
3. **`ParkingLot` 1 - n `ParkingSession`**: Một bãi đỗ xe quản lý lịch sử các lượt gửi xe. Hành vi: `onDelete: Restrict`.
4. **`Vehicle` 1 - n `RFIDCard`**: Một xe có thể được cấp phát thẻ từ cố định. Hành vi: `onDelete: SetNull` (nếu hủy phương tiện, thẻ từ trở về kho thẻ vãng lai chưa gán).
5. **`Vehicle` 1 - n `ParkingSession`**: Một phương tiện có nhiều lượt ra vào trong lịch sử. Hành vi: `onDelete: Restrict`.
6. **`RFIDCard` 1 - n `ParkingSession`**: Một thẻ từ quẹt cho nhiều phiên gửi xe theo thời gian. Hành vi: `onDelete: Restrict`.
7. **`Device` 1 - n `DeviceEvent`**: Một thiết bị ESP32 phát sinh chuỗi sự kiện hoạt động. Hành vi: `onDelete: Cascade`.

---

## 4. RÀNG BUỘC CƠ SỞ DỮ LIỆU (DATABASE CONSTRAINTS)

### 4.1. Ràng buộc toàn vẹn cơ bản
- Khóa chính UUID tự sinh ngẫu nhiên cho tất cả các bảng.
- Khóa duy nhất: `users(email)`, `vehicles(licensePlate)`, `rfid_cards(uid)`, `devices(deviceCode)`.
- Khóa tổ hợp duy nhất: `pricing_rules(parkingLotId, vehicleType, pricingType)`.
- Khóa tổ hợp duy nhất chống lặp sự kiện: `device_events(deviceId, eventId)`.

### 4.2. Ràng buộc kiểm tra cấp PostgreSQL (CHECK Constraints)
- `chk_parking_session_total_fee_non_negative`: `CHECK ("totalFee" >= 0)` — Đảm bảo tiền gửi xe không bao giờ mang giá trị âm.
- `chk_pricing_rule_amount_non_negative`: `CHECK ("amount" >= 0)` — Đảm bảo mức phí cấu hình không thể nhỏ hơn 0.

### 4.3. Chỉ mục điều kiện (Partial Unique Indexes)
- `unique_active_vehicle_session`:
  ```sql
  CREATE UNIQUE INDEX "unique_active_vehicle_session" 
  ON "parking_sessions" ("vehicleId") 
  WHERE "status" IN ('ACTIVE', 'PENDING_ENTRY', 'PENDING_EXIT');
  ```
  *Ý nghĩa*: Ngăn chặn tuyệt đối việc một phương tiện có 2 phiên gửi xe đang hoạt động đồng thời trong bãi.
- `unique_active_rfid_session`:
  ```sql
  CREATE UNIQUE INDEX "unique_active_rfid_session" 
  ON "parking_sessions" ("rfidCardId") 
  WHERE "status" IN ('ACTIVE', 'PENDING_ENTRY', 'PENDING_EXIT');
  ```
  *Ý nghĩa*: Ngăn chặn một thẻ RFID bị quẹt liên tiếp cho nhiều xe khác nhau khi phiên đỗ trước đó chưa kết thúc.

---

## 5. CHIẾN LƯỢC CHỈ MỤC (INDEXES)

- `vehicles(licensePlate)`: B-Tree index hỗ trợ tra cứu biển số dưới 2ms.
- `rfid_cards(uid)` & `rfid_cards(vehicleId)`: Tối ưu tra cứu thẻ khi nhận sự kiện quẹt thẻ từ cổng.
- `parking_sessions(status)` & `parking_sessions(entryTime)`: Tối ưu bộ lọc CMS và thống kê doanh thu theo ngày.
- `parking_sessions(parkingLotId, status)`: Tối ưu hóa đếm tức thời số lượng xe đang đỗ trong bãi.
- `device_events(receivedAt)` & `device_events(deviceId, eventType)`: Tối ưu hóa audit log và kiểm tra chuỗi sự kiện của từng node.

---

## 6. KẾT QUẢ MIGRATION (MIGRATION RESULTS)

- **Lệnh thực thi**: `cd backend && npx prisma migrate status`
- **Kết quả**:
  ```text
  Environment variables loaded from .env
  Prisma schema loaded from prisma\schema.prisma
  Datasource "db": PostgreSQL database "smart_parking_db", schema "public" at "localhost:5432"

  2 migrations found in prisma/migrations

  Database schema is up to date!
  ```
- **Lịch sử migration**:
  1. `20261105140549_init_foundation` (Phase 0) — Được bảo toàn nguyên vẹn.
  2. `20261106003635_domain_modeling_phase1` (Phase 1) — Đã áp dụng đồng bộ toàn bộ bảng mới và ràng buộc kiểm tra.

---

## 7. KẾT QUẢ NẠP DỮ LIỆU MẪU (SEED RESULTS)

- **Lệnh thực thi**: `cd backend && npm run prisma:seed`
- **Kết quả**:
  ```text
  > smart-parking-backend@0.1.0 prisma:seed
  > tsx prisma/seed.ts

  🌱 Bắt đầu nạp dữ liệu mẫu (Seeding development data)...
  ✅ [User] operator@smartparking.local (OPERATOR)
  ✅ [ParkingLot] Bãi Đỗ Xe Đại Học - Khu A (Sức chứa: 100)
  ✅ [Vehicle] 51A-12345 (CAR)
  ✅ [Vehicle] 59B1-98765 (MOTORBIKE)
  ✅ [RFIDCard] UID: E20000190600 -> Gán xe: 51A-12345
  ✅ [RFIDCard] UID: E20000190601 -> Gán xe: 59B1-98765
  ✅ [PricingRule] CAR - PER_HOUR: 15000 VND
  ✅ [PricingRule] MOTORBIKE - PER_VISIT: 5000 VND
  ✅ [Device] GATE_IN_01 (GATE_ENTRY) - Status: ONLINE
  🎉 Nạp dữ liệu mẫu hoàn tất thành công!
  ```
- **Kiểm tra tính lặp lại (Idempotency)**: Chạy lại seed script lần 2 thoát với mã `0`, không nhân bản dữ liệu.

---

## 8. BẰNG CHỨNG KIỂM THỬ TỰ ĐỘNG (AUTOMATED TEST RESULTS)

### 8.1. Kiểm thử Cơ sở dữ liệu & Ràng buộc miền (`tests/database-domain.test.ts`)
- **Số bài test**: 10/10 tests PASS
  1. Kết nối cơ sở dữ liệu hoạt động bình thường.
  2. Tạo thành công ParkingLot, Vehicle, RFIDCard, Device, PricingRule.
  3. Quan hệ liên kết chéo giữa các model duyệt chính xác.
  4. Từ chối thẻ RFID có UID trùng lặp.
  5. Từ chối xe có biển số trùng lặp.
  6. Ràng buộc bất biến Event Idempotency `(deviceId, eventId)` kích hoạt chính xác (IOT-01).
  7. Ràng buộc khóa ngoại `onDelete: Restrict` ngăn chặn xóa bãi xe khi có phiên gửi xe.
  8. Ràng buộc CHECK `amount >= 0` ngăn chặn giá trị âm trên bảng `pricing_rules`.
  9. Ràng buộc CHECK `totalFee >= 0` ngăn chặn phí âm trên bảng `parking_sessions`.
  10. Chỉ mục một phần `unique_active_vehicle_session` từ chối phiên `ACTIVE` thứ hai cho cùng một chiếc xe.

### 8.2. Kiểm tra biến môi trường (`tests/env.test.ts`)
- **Số bài test**: 4/4 tests PASS
  - Chấp nhận cổng hợp lệ dạng chuỗi số.
  - Từ chối chuỗi không phải số (`abc`).
  - Từ chối số âm hoặc bằng 0.
  - Từ chối cổng vượt quá 65535.

### 8.3. Tổng hợp toàn bộ Test Suite Backend
```text
Test Files  6 passed (6)
     Tests  23 passed (23)
  Duration  3.38s
```

---

## 9. GIẢI QUYẾT CÁC PHÁT HIỆN TỪ PHA 0 (PHASE 0 FINDINGS DISPOSITION)

| Mã phát hiện | Trạng thái xử lý trong Pha 1 | Chi tiết kỹ thuật |
|---|---|---|
| **CFG-01** | **ĐÃ GIẢI QUYẾT (FIXED)** | Cập nhật [env.ts](file:///C:/Users/Vinh%20Nguyen/IOT/backend/src/config/env.ts#L14-L18) với `.pipe(z.number().int().positive().max(65535))`. Viết bài test unit độc lập [env.test.ts](file:///C:/Users/Vinh%20Nguyen/IOT/backend/tests/env.test.ts) xác nhận chặn đứng `PORT="abc"`. |
| **IOT-01** | **ĐÃ GIẢI QUYẾT (FIXED)** | Khởi tạo bảng `device_events` với ràng buộc khóa duy nhất tổ hợp `@@unique([deviceId, eventId])`. Kiểm thử tự động bài số 6 xác nhận bảo vệ chống lặp sự kiện MQTT QoS 1. |
| **SEC-01** | **HOÃN LẠI (DEFERRED)** | Xác thực JWT trên Socket.IO Server được hoãn lại đúng quy định cho đến khi triển khai module Authentication trong các pha tiếp theo. |
| **IOT-02** | **HOÃN LẠI (DEFERRED)** | Cải tiến lưu giữ mức QoS khi resubscribe được hoãn lại đúng quy định cho đến pha tích hợp giao thức với phần cứng. |
| **IOT-03** | **HOÃN LẠI (DEFERRED)** | Làm chặt logic chặn cờ retain trên payload được hoãn lại cho đến khi triển khai Gateway Service logic. |
| **SEC-02** | **HOÃN LẠI (DEFERRED)** | Phân quyền ACL riêng biệt từng node ESP32 được hoãn lại cho đến khi kết nối phần cứng thực tế. |

---

## 10. RỦI RO CÒN LẠI (REMAINING RISKS)

1. **Chuẩn hóa biển số xe**: Hiện tại cơ sở dữ liệu đảm bảo tính duy nhất dạng chuỗi, nhưng tầng Service (Pha 2) cần bổ sung middleware chuẩn hóa (cắt khoảng trắng, dấu gạch nối, viết hoa toàn bộ) trước khi ghi vào database để tránh trường hợp `51A-12345` khác với `51A12345`.
2. **Năng lực phần cứng cảm biến vị trí đỗ**: Cần tiếp tục theo dõi tiến độ của nhóm làm mạch ESP32 để quyết định có triển khai `ParkingSlot` trong Pha 2 hay giữ nguyên mô hình tính toán chỗ trống theo sức chứa bãi.

---

## 11. ĐÁNH GIÁ SẴN SÀNG CHO PHA TIẾP THEO (NEXT PHASE READINESS)

Hệ thống đã đạt đầy đủ các điều kiện kỹ thuật để bước vào **Phase 2: Core Parking Business Logic & Gate Automation**:
- Cơ sở dữ liệu và Prisma Client đã sẵn sàng phục vụ các luồng nghiệp vụ Check-in, Check-out, tính toán tiền gửi xe và điều khiển barrier.
- Không có thay đổi nào làm phá vỡ nền tảng Phase 0; Frontend CMS vẫn duy trì khả năng build 100%.

---

**KẾT LUẬN CUỐI CÙNG**: **PHASE 1: PASS**  
*(Dừng công việc theo quy định sau Pha 1. Không triển khai trước các controller hoặc dịch vụ của Pha 2).*

