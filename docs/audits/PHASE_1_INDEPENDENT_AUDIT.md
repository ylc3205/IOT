# BÁO CÁO KIỂM TOÁN ĐỘC LẬP PHA 1: MÔ HÌNH DỮ LIỆU CƠ SỞ DỮ LIỆU (PHASE 1 INDEPENDENT AUDIT)

**Dự án**: SMART PARKING IoT — CMS Management System  
**Phân hệ**: Phase 1 — Database Domain Modeling (PostgreSQL 16 + Prisma ORM 6)  
**Vai trò kiểm toán**: Senior PostgreSQL Database Architect, Prisma ORM Specialist & Independent Code Auditor  
**Chế độ thực thi**: READ-ONLY AUDIT (Không sửa đổi mã nguồn, cấu hình, dữ liệu ứng dụng hay migration)  
**Quyết định cuối cùng**: **PASS**  

---

## 1. TỔNG QUAN ĐIỀU HÀNH (EXECUTIVE SUMMARY)

Một cuộc kiểm toán độc lập, toàn diện và ở chế độ chỉ đọc (Read-Only) đã được tiến hành trên toàn bộ cơ sở mã nguồn và cơ sở dữ liệu PostgreSQL của dự án Smart Parking IoT tại không gian làm việc `C:\Users\Vinh Nguyen\IOT`.

### Mục tiêu kiểm toán:
Độc lập xác minh tuyên bố **PASS** từ tài liệu [PHASE_1_BUILD_REPORT.md](file:///C:/Users/Vinh%20Nguyen/IOT/docs/audits/PHASE_1_BUILD_REPORT.md) thông qua bằng chứng thực tế tại repository và cơ sở dữ liệu đang vận hành.

### Kết quả kiểm toán:
1. **Mô hình thực thể (Domain Entities)**: Toàn bộ 8 thực thể theo yêu cầu (`User`, `ParkingLot`, `Vehicle`, `RFIDCard`, `ParkingSession`, `Device`, `DeviceEvent`, `PricingRule`) được định nghĩa chuẩn xác trong [schema.prisma](file:///C:/Users/Vinh%20Nguyen/IOT/backend/prisma/schema.prisma) với kiểu dữ liệu, khóa chính UUID, quan hệ và chỉ mục tối ưu.
2. **Quyết định hoãn lại thực thể `ParkingSlot`**: Quyết định hoãn lại thực thể này là hoàn toàn đúng đắn về mặt kiến trúc và thực tiễn, tránh tạo ra sự phụ thuộc phức tạp giả định khi nhóm phần cứng chưa hoàn tất cảm biến riêng biệt cho từng vị trí đỗ.
3. **Ràng buộc bất biến cấp cơ sở dữ liệu (PostgreSQL Invariants)**:
   - Các ràng buộc kiểm tra tài chính `CHECK ("totalFee" >= 0)` và `CHECK ("amount" >= 0)` được thực thi tại tầng PostgreSQL engine.
   - Các chỉ mục một phần `unique_active_vehicle_session` và `unique_active_rfid_session` ngăn chặn triệt để tình trạng một phương tiện hoặc một thẻ từ có 2 phiên gửi xe chưa hoàn tất (`ACTIVE`, `PENDING_ENTRY`, `PENDING_EXIT`) đồng thời.
   - Khóa duy nhất tổ hợp `(deviceId, eventId)` trên bảng `device_events` bảo đảm tính bất biến và triệt tiêu trùng lặp sự kiện từ MQTT (khắc phục phát hiện `IOT-01`).
4. **Tính tuyến tính của Migration**: Chuỗi migration hoàn toàn tuyến tính (2 migrations), không có schema drift, không có can thiệp phá hủy dữ liệu.
5. **Chất lượng Seed Script & Tests**: Script `seed.ts` đạt chuẩn idempotent 100%, không chứa thông tin nhạy cảm thật. Bộ test tự động gồm 23 bài test (trong đó có 10 bài test ràng buộc cơ sở dữ liệu thực tế) vượt qua với tỷ lệ thành công 100%.

---

## 2. XÁC MINH CÁC THỰC THỂ MIỀN (VERIFIED DOMAIN ENTITIES)

| Thực thể | Bảng cơ sở dữ liệu | Khóa chính | Khóa duy nhất / Ràng buộc | Đánh giá kiến trúc |
|---|---|---|---|---|
| **User** | `users` | `id` (UUID) | `email` (UNIQUE) | Giữ nguyên trường `role` và UUID từ Pha 0; bổ sung an toàn `passwordHash`, `fullName`, `isActive`. |
| **ParkingLot** | `parking_lots` | `id` (UUID) | — | Quản lý thông số sức chứa `totalCapacity`; liên kết 1-n tới `Device`, `PricingRule`, `ParkingSession`. |
| **Vehicle** | `vehicles` | `id` (UUID) | `licensePlate` (UNIQUE) | Chuẩn hóa biển số xe, phân loại enum `VehicleType` (`CAR`, `MOTORBIKE`). Có B-Tree index. |
| **RFIDCard** | `rfid_cards` | `id` (UUID) | `uid` (UNIQUE) | Trường `vehicleId` nullable hỗ trợ cả thẻ cố định và thẻ vãng lai. Enum `RfidCardStatus`. |
| **ParkingSession** | `parking_sessions` | `id` (UUID) | Partial Unique Indexes | Enum `ParkingSessionStatus`, `PaymentStatus`. Tiền tệ `Decimal(10,2)`. Ràng buộc `totalFee >= 0`. |
| **Device** | `devices` | `id` (UUID) | `deviceCode` (UNIQUE) | Enum `DeviceType` (`GATE_ENTRY`, `GATE_EXIT`, `SENSOR_NODE`), `DeviceStatus`. |
| **DeviceEvent** | `device_events` | `id` (UUID) | `(deviceId, eventId)` (UNIQUE) | Lưu `payload` dạng JSONB, enum `EventProcessingStatus`. Hỗ trợ xử lý bất biến và chống lặp. |
| **PricingRule** | `pricing_rules` | `id` (UUID) | `(parkingLotId, vehicleType, pricingType)` | Tiền tệ `Decimal(10,2)`. Ràng buộc `amount >= 0`. Ngăn trùng lặp biểu giá cùng loại xe. |

---

## 3. ĐÁNH GIÁ MỐI QUAN HỆ & TOÀN VẸN THAM CHIẾU (RELATIONSHIP ASSESSMENT)

### 3.1. Hành vi bảo toàn dữ liệu lịch sử (`onDelete: Restrict`)
Trong hệ thống quản lý bãi đỗ xe và thu phí, **dữ liệu lịch sử vận hành là bất khả xâm phạm**. Kiểm toán ghi nhận thiết kế schema đã áp dụng triệt để nguyên tắc này:
- `parking_sessions.parkingLotId` → `parking_lots(id)`: `ON DELETE RESTRICT`
- `parking_sessions.vehicleId` → `vehicles(id)`: `ON DELETE RESTRICT`
- `parking_sessions.rfidCardId` → `rfid_cards(id)`: `ON DELETE RESTRICT`
- `pricing_rules.parkingLotId` → `parking_lots(id)`: `ON DELETE RESTRICT`
- `devices.parkingLotId` → `parking_lots(id)`: `ON DELETE RESTRICT`

*Kết luận*: Quản trị viên không thể vô tình xóa một bãi xe, phương tiện hay thẻ RFID nếu chúng đã từng phát sinh phiên gửi xe trong quá khứ. Cơ sở dữ liệu sẽ từ chối thao tác bằng ngoại lệ Foreign Key Violation.

### 3.2. Hành vi đối với thẻ từ RFID (`onDelete: SetNull`)
- `rfid_cards.vehicleId` → `vehicles(id)`: `ON DELETE SET NULL`
- *Đánh giá*: Rất hợp lý. Khi một phương tiện rời khỏi hệ thống (ví dụ khách hủy vé tháng), thẻ từ RFID vật lý không bị xóa khỏi kho, mà tự động trở về trạng thái thẻ chưa gán xe (`vehicleId = NULL`), sẵn sàng tái cấp phát cho xe khác.

### 3.3. Hành vi nhật ký sự kiện phần cứng (`onDelete: Cascade`)
- `device_events.deviceId` → `devices(id)`: `ON DELETE CASCADE`
- *Đánh giá*: Phù hợp cho môi trường phát triển. Tuy nhiên, đối với hệ thống thanh tra an ninh sản xuất, việc xóa thiết bị biên nên chuyển sang cơ chế xóa mềm (`isActive = false`) để lưu vết vĩnh viễn các bản tin sự kiện thô.

---

## 4. ĐÁNH GIÁ CHỈ MỤC MỘT PHẦN (PARTIAL UNIQUE INDEX ASSESSMENT)

Kiểm toán đã kiểm tra mã nguồn SQL thực tế trong file migration [20261106003635_domain_modeling_phase1/migration.sql](file:///C:/Users/Vinh%20Nguyen/IOT/backend/prisma/migrations/20261106003635_domain_modeling_phase1/migration.sql#L213-L220):

```sql
-- Chỉ mục duy nhất có điều kiện cho phương tiện
CREATE UNIQUE INDEX "unique_active_vehicle_session" 
ON "parking_sessions" ("vehicleId") 
WHERE "status" IN ('ACTIVE', 'PENDING_ENTRY', 'PENDING_EXIT');

-- Chỉ mục duy nhất có điều kiện cho thẻ RFID
CREATE UNIQUE INDEX "unique_active_rfid_session" 
ON "parking_sessions" ("rfidCardId") 
WHERE "status" IN ('ACTIVE', 'PENDING_ENTRY', 'PENDING_EXIT');
```

### Phân tích trạng thái vòng đời (State Lifecycle Invariants):
1. **Phạm vi bảo vệ**:
   - Bộ lọc `WHERE "status" IN ('ACTIVE', 'PENDING_ENTRY', 'PENDING_EXIT')` bao quát toàn bộ các trạng thái "phiên chưa kết thúc" (in-flight/open sessions).
   - Khi xe hoặc thẻ đang ở cổng vào (`PENDING_ENTRY`), trong bãi (`ACTIVE`), hay tại cổng ra (`PENDING_EXIT`), PostgreSQL từ chối chèn thêm bất kỳ phiên đỗ nào mới cho cùng `vehicleId` hoặc `rfidCardId`.
2. **Giải phóng chỉ mục khi kết thúc**:
   - Khi phiên chuyển sang `COMPLETED` (đã rời bãi) hoặc `CANCELLED` (hủy phiên), bản ghi tự động thoát khỏi phạm vi của Partial Index, cho phép phương tiện/thẻ đó thực hiện lượt gửi mới.
3. **Đánh giá rủi ro trạng thái không nhất quán (Inconsistent States)**:
   - *Tình huống xe không vào bãi*: Nếu phiên ở trạng thái `PENDING_ENTRY` nhưng xe lùi lại không vào, chỉ mục sẽ giữ khóa cho đến khi phiên chuyển sang `CANCELLED`. Đây là hành vi đúng đắn; tầng Service trong Pha 2 cần có worker tự động hủy phiên `PENDING_ENTRY` sau một khoảng timeout (ví dụ 60 giây).
   - *Ràng buộc liên kết Thẻ - Xe*: Database Partial Index ngăn chặn việc dùng 1 thẻ cho 2 xe đồng thời. Tuy nhiên, việc xác thực "Thẻ A chỉ được dùng cho Xe A" (nếu thẻ đã gán cố định) là trách nhiệm nghiệp vụ của Check-in Service trong Pha 2.

---

## 5. ĐÁNH GIÁ TÍNH BẤT BIẾN SỰ KIỆN MQTT (MQTT EVENT IDEMPOTENCY)

Khóa duy nhất tổ hợp được khai báo tại [schema.prisma](file:///C:/Users/Vinh%20Nguyen/IOT/backend/prisma/schema.prisma#L225):
```prisma
@@unique([deviceId, eventId], name: "deviceId_eventId")
```
Được khởi tạo trong PostgreSQL:
```sql
CREATE UNIQUE INDEX "device_events_deviceId_eventId_key" ON "device_events"("deviceId", "eventId");
```

### 5.1. Cơ chế đảm bảo cấp Cơ sở dữ liệu:
- Do giao thức MQTT QoS 1 hoạt động theo nguyên tắc *"At-least-once delivery"*, khi mất kết nối mạng tạm thời, broker hoặc thiết bị ESP32 có thể gửi lại cùng một bản tin (retransmission).
- Khóa duy nhất `(deviceId, eventId)` bảo đảm ở mức nguyên tử (atomic) rằng không bao giờ có 2 bản ghi trùng lặp được ghi vào bảng `device_events`.

### 5.2. Yêu cầu xử lý giao dịch tại tầng ứng dụng (Pha 2):
- Database unique constraint sẽ ném lỗi `P2002 (Unique constraint failed)` khi bản tin trùng lặp gửi đến.
- Tầng Service trong Pha 2 phải bọc thao tác nhận bản tin trong transaction hoặc bắt lỗi `P2002` để:
  1. Ghi nhận bản tin trùng lặp dưới trạng thái `processingStatus = 'IGNORED'`.
  2. Tuyệt đối **không kích hoạt lệnh mở barrier lần thứ hai** (`GATE_COMMAND`).

---

## 6. ĐÁNH GIÁ RÀNG BUỘC TÀI CHÍNH (FINANCIAL CONSTRAINTS)

Kiểm toán đã xác nhận:
1. **Kiểu dữ liệu tiền tệ**: Cả `parking_sessions.totalFee` và `pricing_rules.amount` đều sử dụng kiểu `Decimal(10, 2)` (PostgreSQL `NUMERIC(10,2)`). Điều này ngăn chặn hoàn toàn sai số tích lũy dấu phẩy động (floating-point inaccuracies) vốn xảy ra với kiểu `FLOAT`/`DOUBLE`.
2. **Ràng buộc kiểm tra cấp PostgreSQL**:
   - [migration.sql:208](file:///C:/Users/Vinh%20Nguyen/IOT/backend/prisma/migrations/20261106003635_domain_modeling_phase1/migration.sql#L208): `ALTER TABLE "parking_sessions" ADD CONSTRAINT "chk_parking_session_total_fee_non_negative" CHECK ("totalFee" >= 0);`
   - [migration.sql:211](file:///C:/Users/Vinh%20Nguyen/IOT/backend/prisma/migrations/20261106003635_domain_modeling_phase1/migration.sql#L211): `ALTER TABLE "pricing_rules" ADD CONSTRAINT "chk_pricing_rule_amount_non_negative" CHECK ("amount" >= 0);`
   - Được kiểm thử thực tế bằng lệnh chèn giá trị âm (`-5000` và `-10000`) qua raw SQL trong các bài test 8 và 9 của `tests/database-domain.test.ts`. Cả hai đều bị PostgreSQL chặn đứng và trả về lỗi vi phạm ràng buộc CHECK.

---

## 7. ĐÁNH GIÁ MIGRATION (DATABASE MIGRATION AUDIT)

Lịch sử migration trong `backend/prisma/migrations/`:
1. `20261105140549_init_foundation` (Phase 0):
   - Tạo bảng `database_verifications` và cấu trúc `users` ban đầu.
2. `20261106003635_domain_modeling_phase1` (Phase 1):
   - Thêm cột vào `users` bằng `ADD COLUMN` an toàn (nullable và default value).
   - Tạo các bảng nghiệp vụ, enums, khóa ngoại, CHECK constraints và Partial unique indexes.

### Kết quả lệnh kiểm tra:
```powershell
Command: cd backend; npx prisma migrate status
Exit Code: 0
Output:
2 migrations found in prisma/migrations
Database schema is up to date!
```
*Kết luận*: Chuỗi migration hoàn toàn tuyến tính, không có can thiệp sửa đổi các migration cũ, không có hiện tượng schema drift.

---

## 8. ĐÁNH GIÁ DỮ LIỆU SEED (SEED AUDIT)

File kiểm tra: [seed.ts](file:///C:/Users/Vinh%20Nguyen/IOT/backend/prisma/seed.ts)

| Tiêu chuẩn kiểm tra | Trạng thái | Đánh giá chi tiết |
|---|---|---|
| **Tính lặp lại (Idempotency)** | **ĐẠT** | 100% lệnh chèn sử dụng `prisma.<model>.upsert` với khóa duy nhất cố định. Chạy lại script nhiều lần không sinh ra dữ liệu trùng. |
| **Dữ liệu phát triển an toàn** | **ĐẠT** | Email sử dụng đuôi giả định `@smartparking.local`. Biển số xe mẫu `51A-12345`, `59B1-98765`. |
| **Bảo mật thông tin đăng nhập** | **ĐẠT** | Không chứa mật khẩu thật dạng plain-text; sử dụng chuỗi hash placeholder `$2a$10$...`. |
| **Không giả lập phiên đỗ xe** | **ĐẠT** | Đúng quy chuẩn: **Không có bất kỳ bản ghi `ParkingSession` nào được tạo trong seed**. Bãi xe bắt đầu ở trạng thái trống thực tế. |

---

## 9. ĐÁNH GIÁ CHẤT LƯỢNG KIỂM THỬ (TEST QUALITY ASSESSMENT)

File kiểm tra: [tests/database-domain.test.ts](file:///C:/Users/Vinh%20Nguyen/IOT/backend/tests/database-domain.test.ts) và [tests/env.test.ts](file:///C:/Users/Vinh%20Nguyen/IOT/backend/tests/env.test.ts)

- **Không mock dữ liệu**: Toàn bộ 10 bài test trong `database-domain.test.ts` đều tương tác trực tiếp với cơ sở dữ liệu PostgreSQL thực tế trong container qua PrismaClient.
- **Cô lập dữ liệu an toàn**: Sử dụng định danh động `testRunId = Date.now().toString(36)` làm tiền tố cho mọi bản ghi (`TEST_LOT_...`, `TEST_PLATE_...`, `TEST_UID_...`). Không gây ảnh hưởng đến dữ liệu seed hay dữ liệu phát triển có sẵn.
- **Dọn dẹp sạch sẽ (Cleanup)**: Hook `afterAll` thực thi xóa các bản ghi mang tiền tố `testRunId` theo đúng trình tự phụ thuộc khóa ngoại ngược chiều, ngăn ngừa rác dữ liệu sau khi chạy test.
- **Bao phủ các trường hợp biên và vi phạm**: Kiểm thử đầy đủ lỗi trùng UID thẻ, trùng biển số xe, trùng Event ID, vi phạm khóa ngoại xóa bãi xe, chèn giá tiền âm, chèn phí gửi xe âm, và tạo 2 phiên active cho 1 xe.

---

## 10. TỔNG HỢP CÁC PHÁT HIỆN KIỂM TOÁN (FINDINGS & OBSERVATIONS)

| Mức độ | Mã phát hiện | Mô tả chi tiết | Vị trí tệp tin | Khuyến nghị cho Pha 2 |
|---|---|---|---|---|
| **INFO** | `DOM-01` | Ràng buộc duy nhất `vehicles.licensePlate` phân biệt chính xác theo chuỗi ký tự, nhưng chưa có chuẩn hóa định dạng (dấu gạch nối, khoảng trắng). | [schema.prisma:134](file:///C:/Users/Vinh%20Nguyen/IOT/backend/prisma/schema.prisma#L134) | Thêm tiện ích `normalizeLicensePlate()` tại tầng Service Check-in (Pha 2) để loại bỏ dấu gạch ngang và khoảng trắng trước khi tra cứu/lưu trữ. |
| **INFO** | `DOM-02` | `unique_active_vehicle_session` ngăn 1 xe có 2 phiên mở, nhưng việc kiểm tra tính hợp lệ giữa Xe và Thẻ RFID (nếu thẻ đã gán cho xe) cần được thực hiện tại tầng nghiệp vụ. | [DOMAIN_MODEL.md:95](file:///C:/Users/Vinh%20Nguyen/IOT/docs/database/DOMAIN_MODEL.md#L95) | Triển khai validation trong Check-in Service (Pha 2): Nếu thẻ quẹt đã có `vehicleId`, biển số xe check-in phải khớp với `rfidCard.vehicleId`. |
| **LOW** | `DOM-03` | `device_events.deviceId` sử dụng `onDelete: Cascade`. | [schema.prisma:222](file:///C:/Users/Vinh%20Nguyen/IOT/backend/prisma/schema.prisma#L222) | Xem xét chuyển sang cơ chế Soft Delete (`isActive: false`) cho bảng `Device` ở pha sau để lưu vết audit trail vĩnh viễn. |
| **LOW** | `DEP-01` | Cảnh báo deprecation của Prisma về cấu hình `package.json#prisma` trong Prisma 7. | [package.json:19](file:///C:/Users/Vinh%20Nguyen/IOT/backend/package.json#L19) | Cân nhắc chuyển cấu hình seed sang `prisma.config.ts` khi nâng cấp lên Prisma 7 trong tương lai. Hiện tại không ảnh hưởng đến hoạt động của Prisma 6. |

---

## 11. BẰNG CHỨNG XÁC MINH HỆ THỐNG THỰC TẾ (VERIFICATION EVIDENCE)

Tất cả các lệnh kiểm tra được thực thi trực tiếp và ghi nhận nguyên văn:

```powershell
# 1. Kiểm tra tính hợp lệ của Prisma Schema
Command: cd backend; npx prisma validate
Exit Code: 0
Output: The schema at prisma\schema.prisma is valid 🚀

# 2. Kiểm tra trạng thái Migration
Command: cd backend; npx prisma migrate status
Exit Code: 0
Output: 
2 migrations found in prisma/migrations
Database schema is up to date!

# 3. Kiểm tra kiểu dữ liệu TypeScript (Strict Mode)
Command: cd backend; npm run typecheck
Exit Code: 0
Output: > tsc --noEmit (0 errors)

# 4. Kiểm tra Chuẩn mã nguồn ESLint
Command: cd backend; npm run lint
Exit Code: 0
Output: > eslint . (0 errors, 0 warnings)

# 5. Chạy toàn bộ Test Suite Backend
Command: cd backend; npm run test
Exit Code: 0
Output:
 RUN  v3.2.7 C:/Users/Vinh Nguyen/IOT/backend
 ✓ tests/env.test.ts (4 tests) 6ms
 ✓ tests/mqtt.test.ts (4 tests) 4ms
 ✓ tests/mqtt-integration.test.ts (1 test) 162ms
 ✓ tests/database-domain.test.ts (10 tests) 481ms
 ✓ tests/api-response.test.ts (2 tests) 72ms
 ✓ tests/health.test.ts (2 tests) 38ms
 Test Files  6 passed (6)
      Tests  23 passed (23)

# 6. Kiểm tra Biên dịch Production Backend
Command: cd backend; npm run build
Exit Code: 0
Output: > tsc (Biên dịch thành công sang dist/)

# 7. Trạng thái Container Docker
Command: docker compose ps
Exit Code: 0
Output:
smart-parking-mosquitto   eclipse-mosquitto:latest   Up (healthy)   0.0.0.0:1883->1883/tcp
smart-parking-postgres    postgres:16-alpine         Up (healthy)   0.0.0.0:5432->5432/tcp
```

---

## 12. KẾT LUẬN & TÍNH SẴN SÀNG CHO PHA 2 (PHASE 2 READINESS)

### Quyết định kiểm toán cuối cùng: **PASS**

### Đánh giá sẵn sàng cho Pha 2:
Mô hình dữ liệu cơ sở dữ liệu Phase 1 đã hoàn thiện đạt chuẩn công nghiệp, bảo đảm đầy đủ các yêu cầu toàn vẹn, bảo mật, hiệu năng và tính bất biến. Hệ thống **HOÀN TOÀN SẴN SÀNG** để đội ngũ kỹ thuật tiến hành triển khai **Phase 2: Core Parking Business Logic & Gate Automation** (xử lý luồng Check-in, Check-out, tính toán thời gian gửi xe, áp dụng biểu giá và tự động hóa điều khiển barrier).

*Cuộc kiểm toán độc lập Read-Only kết thúc tại đây. Không có mã nguồn hay dữ liệu nào bị thay đổi.*

