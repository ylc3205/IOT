# SMART PARKING IOT — PHASE 3 TARGETED DEFECT FIX REPORT

**Dự án**: Smart Parking IoT — CMS Management System
**Pha thực hiện**: Phase 3 Hardening & Defect Verification
**Trạng thái kiểm định**: **PASS**
**Thời gian hoàn thành**: 2026-11-07
**Môi trường thử nghiệm**: Local Node.js LTS, Docker Engine (PostgreSQL 16 & Eclipse Mosquitto)

---

## 1. TỔNG QUAN XÁC MINH & KẾT QUẢ RÀ SOÁT (VERIFICATION SUMMARY)

Báo cáo này đánh giá độc lập và sửa chữa dứt điểm 6 điểm rà soát kỹ thuật (F01 - F06) trước khi chuyển giao sang Pha 4:

| Mã | Hạng mục rà soát | Kết luận rà soát | Hành động xử lý kỹ thuật |
| :---: | :--- | :---: | :--- |
| **F01** | Entry Timeout trong `cancelExpiredEntrySession()` | **Xác nhận lỗi (Confirmed Defect)** | Bổ sung kiểm tra thời gian trôi qua thực tế `(now - entryTime) >= timeoutSeconds * 1000` (mặc định 60 giây). Giữ nguyên khóa dòng `FOR UPDATE` để đồng bộ nguyên tử với `confirmEntryPassage()`. |
| **F02** | Thẻ RFID giả lập (Placeholder) trong `manualEntry()` | **Xác nhận khiếm khuyết (Confirmed Defect)** | Tạo migration mới cho phép `rfidCardId` trong `parking_sessions` nhận giá trị `NULL`. Vào thủ công không quét thẻ lưu trực tiếp `rfidCardId = null`, không tạo bản ghi rác trong kho thẻ `rfid_cards`. |
| **F03** | Tính nguyên tử giao dịch `manualEntry()` | **Xác nhận lỗi (Confirmed Defect)** | Di chuyển toàn bộ quá trình tìm/tạo phương tiện và thẻ RFID vào bên trong transaction `prisma.$transaction(...)`. Khi bãi xe hết chỗ hoặc vi phạm trạng thái, toàn bộ giao dịch bị hủy và không để lại xe rác trong bảng `vehicles`. |
| **F04** | Sai lệch tài liệu động cơ tính cước | **Sai lệch tài liệu (Documentation Fix)** | Động cơ `BillingCalculator` đang chạy đúng thuật toán chuẩn: `Math.max(1, Math.ceil(durationMinutes / 60))`. Đã đính chính tài liệu loại bỏ mô tả nhầm lẫn về "15 phút làm tròn lũy tiến" và bổ sung test cases cho 60, 61, 70, 80, 125 phút. |
| **F05** | Nguy cơ mất lịch sử tài chính `onDelete: Cascade` | **Xác nhận rủi ro bảo toàn (Confirmed Defect)** | Tạo migration thay đổi quan hệ khóa ngoại giữa `parking_session_payments` và `parking_sessions` thành `onDelete: Restrict`, đảm bảo không thể xóa cứng phiên đỗ nếu đã phát sinh chứng từ thu tiền. |
| **F06** | Tính toàn vẹn của thời gian ân hạn và thanh toán | **Đã kiểm chứng (Verified & Hardened)** | Xác minh phụ thu quá giờ được lưu bền vững khi hủy lượt ra; tiền đã thu đợt trước bảo toàn nguyên vẹn; xuất bãi trong thời gian ân hạn (5 phút) không phát sinh cước. Bổ sung các bài kiểm thử hồi quy tương ứng. |

---

## 2. CHI TIẾT CÁC THAY ĐỔI CƠ SỞ DỮ LIỆU & MÃ NGUỒN

### 2.1 Di chuyển cơ sở dữ liệu tuyến tính (Forward-only Migration)

- **Migration**: `20261107035111_phase3_harden_session_and_payments`
- **Tệp tin**: `backend/prisma/migrations/20261107035111_phase3_harden_session_and_payments/migration.sql`
- **Nội dung SQL**:
  ```sql
  -- Chuyển rfidCardId sang Nullable để hỗ trợ xe vào thủ công không cần thẻ
  ALTER TABLE "parking_sessions" ALTER COLUMN "rfidCardId" DROP NOT NULL;

  -- Cập nhật khóa ngoại rfidCardId sang ON DELETE SET NULL
  ALTER TABLE "parking_sessions" DROP CONSTRAINT "parking_sessions_rfidCardId_fkey";
  ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_rfidCardId_fkey"
    FOREIGN KEY ("rfidCardId") REFERENCES "rfid_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

  -- Bảo toàn lịch sử tài chính: Ngăn chặn xóa cứng phiên đỗ nếu đã có phiếu thu
  ALTER TABLE "parking_session_payments" DROP CONSTRAINT "parking_session_payments_session_id_fkey";
  ALTER TABLE "parking_session_payments" ADD CONSTRAINT "parking_session_payments_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "parking_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

  -- Tái tạo chỉ mục duy nhất cho phiên hoạt động trên thẻ RFID, loại trừ các phiên null
  DROP INDEX IF EXISTS "unique_active_rfid_session";
  CREATE UNIQUE INDEX "unique_active_rfid_session" ON "parking_sessions" ("rfidCardId")
    WHERE "status" IN ('ACTIVE', 'PENDING_ENTRY', 'PENDING_EXIT') AND "rfidCardId" IS NOT NULL;
  ```

### 2.2 Các tệp tin mã nguồn cập nhật

1. `backend/prisma/schema.prisma`:
   - `ParkingSession`: `rfidCardId String?`, quan hệ `onDelete: SetNull`.
   - `ParkingSessionPayment`: quan hệ `session` chuyển sang `onDelete: Restrict`.
2. `backend/src/modules/parking-sessions/parking-session.service.ts`:
   - Import `env` từ cấu hình hệ thống.
   - `cancelExpiredEntrySession()`: Thêm tham số `timeoutSeconds` và logic kiểm tra `(now.getTime() - session.entryTime.getTime()) >= timeoutMs`.
   - `manualEntry()`: Đưa việc tìm/tạo `vehicle` và `card` vào trong `prisma.$transaction(...)`. Nếu không có `rfidCardUid`, gán `rfidCardId = null` thay vì tạo thẻ giả.
3. `backend/tests/billing-calculator.test.ts`:
   - Bổ sung test case `BIL-05b` kiểm thử lũy tiến cho các mốc: 70 phút (tính 2 giờ), 80 phút (tính 2 giờ), 125 phút (tính 3 giờ).
4. `backend/tests/session-lifecycle.test.ts`:
   - Bổ sung `LIF-11`: Kiểm thử đầy đủ các điều kiện của Entry Timeout (< 60s không hủy, > 60s hủy, ACTIVE không bị hủy).
   - Bổ sung `LIF-12`: Kiểm thử vào thủ công không truyền RFID (`rfidCardId: null`, không tạo bản ghi thẻ).
   - Bổ sung `LIF-13`: Kiểm thử tính nguyên tử khi bãi đầy (xe mới không bị lưu lại trong CSDL khi admission bị từ chối).
   - Bổ sung `LIF-14`: Kiểm thử ra bãi trong thời gian ân hạn (5 phút sau thanh toán) không phát sinh phụ thu.
   - Bổ sung `LIF-15`: Kiểm thử `onDelete: Restrict` ngăn chặn xóa cứng phiên đã thu tiền.
5. `backend/tests/session-concurrency.test.ts`:
   - Cập nhật test `CON-03` truyền `timeoutSeconds = 0` khi giả lập timeout cleanup cạnh tranh trực tiếp với passage confirmation.
6. `docs/audits/PHASE_3_BUILD_REPORT.md`:
   - Đính chính mô tả thuật toán tính cước theo giờ chuẩn `Math.max(1, Math.ceil(durationMinutes / 60))`.

---

## 3. BẰNG CHỨNG KIỂM TRA & THỰC THI (VERIFICATION EVIDENCE)

### 3.1 Trạng thái di chuyển CSDL (Prisma Migrate Status)

```bash
$ cd backend && npx prisma migrate status
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "smart_parking_db", schema "public" at "localhost:5432"

5 migrations found in prisma/migrations:
  - 20261105140549_init_foundation
  - 20261106003635_domain_modeling_phase1
  - 20261106021903_parking_slot_extension
  - 20261106171541_parking_session_lifecycle
  - 20261107035111_phase3_harden_session_and_payments

Database schema is up to date!
```
*Kết quả*: **PASS** (5/5 migrations tuyến tính, sạch sẽ).

### 3.2 Kiểm tra biên dịch TypeScript (Strict Mode)

```bash
$ cd backend && npm run typecheck
> smart-parking-backend@0.1.0 typecheck
> tsc --noEmit
Exit code: 0
```
*Kết quả*: **PASS** (0 lỗi).

### 3.3 Kiểm tra chuẩn mã nguồn (ESLint)

```bash
$ cd backend && npm run lint
> smart-parking-backend@0.1.0 lint
> eslint .
Exit code: 0
```
*Kết quả*: **PASS** (0 errors, 0 warnings).

### 3.4 Kiểm thử tự động toàn diện Backend (Vitest Test Suite)

```bash
$ cd backend && npm test
> smart-parking-backend@0.1.0 test
> vitest run

 RUN  v3.2.7 C:/Users/Vinh Nguyen/IOT/backend

 ✓ tests/session-lifecycle.test.ts (15 tests)
 ✓ tests/session-concurrency.test.ts (3 tests)
 ✓ tests/parking-session-api.test.ts (6 tests)
 ✓ tests/admission-capacity.test.ts (4 tests)
 ✓ tests/billing-calculator.test.ts (10 tests)
 ✓ tests/idempotency.test.ts (3 tests)
 ✓ tests/database-domain.test.ts (12 tests)
 ✓ tests/rfid.test.ts (7 tests)
 ✓ tests/parking-slot.test.ts (7 tests)
 ✓ tests/parking-lot.test.ts (5 tests)
 ✓ tests/vehicle.test.ts (5 tests)
 ✓ tests/pricing.test.ts (5 tests)
 ✓ tests/auth.test.ts (5 tests)
 ✓ tests/health.test.ts (2 tests)
 ✓ tests/api-response.test.ts (2 tests)
 ✓ tests/mqtt-integration.test.ts (1 test)
 ✓ tests/mqtt.test.ts (4 tests)
 ✓ tests/env.test.ts (4 tests)

 Test Files  18 passed (18)
      Tests  100 passed (100)
   Start at  10:57:35
   Duration  16.34s
Exit code: 0
```
*Kết quả*: **PASS** (**100/100 tests đạt 100%**, tăng thêm 6 tests so với 94 tests trước khi hardening, 0 bài trượt, không xảy ra hồi quy).

### 3.5 Kiểm tra biên dịch Backend (Production Build)

```bash
$ cd backend && npm run build
> smart-parking-backend@0.1.0 build
> tsc
Exit code: 0
```
*Kết quả*: **PASS**.

### 3.6 Kiểm tra hồi quy Frontend (Frontend Build Reproducibility)

```bash
$ cd frontend && npm run build
> smart-parking-cms@0.1.0 build
> tsc -b && vite build

vite v6.4.5 building for production...
✓ 1709 modules transformed.
dist/index.html                   0.55 kB │ gzip:   0.37 kB
dist/assets/index-BpV4LKxx.css   19.79 kB │ gzip:   4.42 kB
dist/assets/index-tkFbNodF.js   367.15 kB │ gzip: 119.79 kB
✓ built in 5.25s
Exit code: 0
```
*Kết quả*: **PASS**.

---

## 4. TỔNG KẾT

Tất cả 6 hạng mục rà soát (F01–F06) đã được thẩm định độc lập và xử lý triệt để:
- Toàn vẹn giao dịch và bảo toàn dữ liệu tài chính được củng cố ở mức tối đa (`onDelete: Restrict`, ACID rollback khi hết chỗ).
- Loại bỏ hoàn toàn việc sinh thẻ RFID giả lập làm sai lệch kho thẻ vật lý.
- Bộ kiểm thử tự động đạt mốc 100 bài test xanh hoàn toàn.

**KẾT LUẬN**: **PHASE 3 FIX: PASS**.
