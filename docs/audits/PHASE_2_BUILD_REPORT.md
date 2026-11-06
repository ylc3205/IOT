# SMART PARKING IOT — PHASE 2 BUILD & VERIFICATION REPORT

**Dự án**: Smart Parking IoT — CMS Management System  
**Pha thực hiện**: Phase 2 — Core Backend Services & Parking Slot Database Extension  
**Trạng thái nghiệm thu**: **PASS**  
**Thời gian hoàn thành**: 2026-11-06  
**Môi trường thử nghiệm**: Local Node.js LTS, Docker Engine (PostgreSQL 16 & Eclipse Mosquitto)

---

## 1. TỔNG QUAN PHẠM VI TRIỂN KHAI (EXECUTIVE SUMMARY)

Pha 2 đã triển khai thành công toàn bộ các dịch vụ Backend cốt lõi, mở rộng mô hình cơ sở dữ liệu cho từng vị trí đỗ xe (`ParkingSlot`), tích hợp kiểm soát bảo mật nâng cao và hoàn thành 100% các mục tiêu kỹ thuật được phê duyệt:

1. **Mở rộng lược đồ cơ sở dữ liệu**:
   - Bổ sung enums `SensorStatus` (`EMPTY`, `OCCUPIED`, `UNKNOWN`) và `SlotOperationalStatus` (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE`).
   - Tạo thực thể `ParkingSlot` liên kết với `ParkingLot` (`onDelete: Restrict`) và `Device` (`onDelete: SetNull`).
   - Thiết lập migration tuyến tính `20261106021903_parking_slot_extension` với các ràng buộc CHECK PostgreSQL nâng cao:
     - `chk_parking_slot_sensor_mapping_pair`: Thiết bị và kênh cảm biến phải cùng `NULL` hoặc cùng `NOT NULL`.
     - `chk_parking_slot_sensor_channel_positive`: Kênh cảm biến vật lý nếu có phải $> 0$.
     - Khóa duy nhất `(parkingLotId, slotCode)` và `(sensorDeviceId, sensorChannel)`.
2. **Nâng cấp bảo mật & Tiện ích dùng chung**:
   - Cài đặt và tích hợp `helmet` tại đầu chuỗi Express middleware.
   - Triển khai middleware xác thực JWT Bearer (`jwtAuthMiddleware`) bảo vệ toàn bộ API nghiệp vụ.
   - Khắc phục triệt để phát hiện kiểm toán `SEC-01`: Bổ sung middleware xác thực JWT handshake cho toàn bộ kết nối WebSocket Socket.IO.
   - Thư viện chuẩn hóa chuỗi `normalizeLicensePlate` và `normalizeRfidUid` đảm bảo dữ liệu nhất quán giữa CMS và phần cứng IoT.
3. **Hiện thực hóa 6 phân hệ nghiệp vụ theo chuẩn Modular Monolith**:
   - **Auth**: `POST /api/auth/login`, `GET /api/auth/me`.
   - **ParkingLot**: `GET /api/parking-lots`, `GET /api/parking-lots/:id`, `POST /api/parking-lots`, `PATCH /api/parking-lots/:id`, `GET /api/parking-lots/:id/occupancy`.
   - **ParkingSlot**: `GET /api/parking-lots/:lotId/slots`, `POST /api/parking-lots/:lotId/slots`, `GET /api/parking-slots/:id`, `PATCH /api/parking-slots/:id`.
   - **Vehicle**: `GET /api/vehicles`, `GET /api/vehicles/:id`, `POST /api/vehicles`, `PATCH /api/vehicles/:id`.
   - **RFID**: `GET /api/rfid-cards`, `GET /api/rfid-cards/:id`, `POST /api/rfid-cards`, `PATCH /api/rfid-cards/:id`, `POST /api/rfid-cards/:id/assign`, `POST /api/rfid-cards/:id/unassign`, `POST /api/rfid-cards/:id/block`, `POST /api/rfid-cards/:id/unblock`.
   - **Pricing**: `GET /api/pricing-rules`, `GET /api/pricing-rules/:id`, `POST /api/pricing-rules`, `PATCH /api/pricing-rules/:id`.
4. **Cập nhật dữ liệu mẫu (Seed Script)**:
   - Nạp mật khẩu quản trị viên được mã hóa bcrypt an toàn thông qua biến môi trường `SEED_ADMIN_PASSWORD`.
   - Nạp thiết bị cảm biến `SENSOR_NODE_01` và 4 vị trí đỗ xe mẫu (`A-01`, `A-02`, `A-03`, `B-01`).

---

## 2. BẰNG CHỨNG KIỂM TRA & THỰC THI (VERIFICATION EVIDENCE)

### 2.1 Kiểm tra di chuyển cơ sở dữ liệu (Prisma Migrate Status)

```bash
$ cd backend && npx prisma migrate status
Database schema is up to date!
3 migrations found in prisma/migrations:
  - 20261105140549_init_foundation
  - 20261106003635_domain_modeling_phase1
  - 20261106021903_parking_slot_extension
```
*Kết quả*: **PASS**.

### 2.2 Kiểm tra biên dịch TypeScript (Strict Mode)

```bash
$ cd backend && npm run typecheck
> smart-parking-backend@0.1.0 typecheck
> tsc --noEmit
Exit code: 0
```
*Kết quả*: **PASS** (0 errors).

### 2.3 Kiểm tra chuẩn mã nguồn (ESLint)

```bash
$ cd backend && npm run lint
> smart-parking-backend@0.1.0 lint
> eslint .
Exit code: 0
```
*Kết quả*: **PASS** (0 errors, 0 warnings).

### 2.4 Kiểm thử tự động Backend (Vitest Test Suite)

```bash
$ cd backend && npm test
> smart-parking-backend@0.1.0 test
> vitest run

 RUN  v3.2.7 C:/Users/Vinh Nguyen/IOT/backend

 ✓ tests/env.test.ts (4 tests)
 ✓ tests/mqtt.test.ts (4 tests)
 ✓ tests/database-domain.test.ts (12 tests)
 ✓ tests/mqtt-integration.test.ts (1 test)
 ✓ tests/api-response.test.ts (2 tests)
 ✓ tests/health.test.ts (2 tests)
 ✓ tests/parking-lot.test.ts (5 tests)
 ✓ tests/pricing.test.ts (5 tests)
 ✓ tests/vehicle.test.ts (5 tests)
 ✓ tests/parking-slot.test.ts (7 tests)
 ✓ tests/rfid.test.ts (7 tests)
 ✓ tests/auth.test.ts (5 tests)

 Test Files  12 passed (12)
      Tests  59 passed (59)
   Duration  2.06s
Exit code: 0
```
*Kết quả*: **PASS** (59/59 tests đạt 100%).

### 2.5 Biên dịch Backend (Production Build)

```bash
$ cd backend && npm run build
> smart-parking-backend@0.1.0 build
> tsc
Exit code: 0
```
*Kết quả*: **PASS**.

### 2.6 Kiểm tra hồi quy Frontend (Frontend Regression)

```bash
$ cd frontend && npm run typecheck && npm run test && npm run build
> smart-parking-cms@0.1.0 typecheck: 0 errors
> smart-parking-cms@0.1.0 test: 1 passed (4 tests)
> smart-parking-cms@0.1.0 build: ✓ built in 2.74s
dist/index.html                   0.55 kB
dist/assets/index-BpV4LKxx.css   19.79 kB
dist/assets/index-tkFbNodF.js   367.15 kB
Exit code: 0
```
*Kết quả*: **PASS**.

---

## 3. TỔNG KẾT BẢO TOÀN DỰ ÁN (GIT HYGIENE)

- Không thực hiện bất kỳ lệnh Git mang tính phá hủy nào (`git reset`, `git clean`).
- Không tự ý commit hoặc push mã nguồn lên remote repository.
- Toàn bộ cơ sở hạ tầng Phase 0 và Phase 1 được bảo tồn trọn vẹn, sẵn sàng chuyển tiếp sang Phase 3 (Business Logic & Event Workflows) khi có yêu cầu.

