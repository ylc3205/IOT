# SMART PARKING IOT — PHASE 3 BUILD & VERIFICATION REPORT

**Dự án**: Smart Parking IoT — CMS Management System  
**Pha thực hiện**: Phase 3 — Parking Session Management, Billing & Manual Operations  
**Trạng thái nghiệm thu**: **PASS**  
**Thời gian hoàn thành**: 2026-11-07  
**Môi trường thử nghiệm**: Local Node.js LTS, Docker Engine (PostgreSQL 16 & Eclipse Mosquitto)

---

## 1. TỔNG QUAN PHẠM VI TRIỂN KHAI (EXECUTIVE SUMMARY)

Pha 3 đã hiện thực hóa trọn vẹn và hoàn chỉnh toàn bộ logic nghiệp vụ cốt lõi về quản lý phiên gửi xe (`ParkingSession`), động cơ tính toán cước phí lũy tiến (`BillingCalculator`), thuật toán bảo vệ sức chứa chống bán vượt (`AdmissionService`), middleware xử lý trùng lặp yêu cầu HTTP (`IdempotencyMiddleware`), cùng bộ REST API quản trị và vận hành cổng thủ công cho CMS:

1. **Mở rộng lược đồ cơ sở dữ liệu (Prisma Schema Migration)**:
   - Migration `20261106171541_parking_session_lifecycle` áp dụng thành công trên PostgreSQL 16.
   - Bổ sung thực thể `ParkingSessionPayment` lưu trữ lịch sử từng lần thanh toán tiền mặt (hỗ trợ phụ thu quá hạn rời bãi).
   - Bổ sung thực thể `IdempotencyKey` bảo vệ chống gửi trùng lặp yêu cầu mạng đột biến bằng SHA-256 fingerprint và khóa thời gian thực.
   - Bổ sung 14 trường dữ liệu snapshot biểu giá, chốt cước, thanh toán, vết kiểm toán nhân viên vận hành thủ công và lý do hủy phiên trên `ParkingSession`.
2. **Động cơ tính phí gửi xe (Billing Calculator Engine)**:
   - Quy tắc làm tròn lên lũy tiến 15 phút: $\text{durationMinutes} \le 15$ tính 1 giờ đầu; $>15$ phút lẻ tính tròn thêm 1 giờ tiếp theo.
   - Bảo toàn biểu giá snapshot (`pricingRate`, `pricingType`) độc lập với các thay đổi sau này của bảng biểu giá.
   - Kiểm soát thời gian ân hạn rời bãi (Grace Period, mặc định 10 phút). Nếu xe nán lại bãi quá ân hạn, hệ thống tự động phát hiện phụ thu quá giờ và không thu trùng khoản tiền đã trả.
3. **Thuật toán tiếp nhận xe bảo thủ (Conservative Admission Guard)**:
   - Khóa bi quan dòng bãi xe `SELECT id FROM parking_lots WHERE id = $1 FOR UPDATE`.
   - Công thức triệt tiêu 100% rủi ro đếm trùng (zero double-counting) giữa cảm biến vật lý và phiên logic:
     $$\text{SafeAvailableSpaces} = \min\Big(\text{lot.totalCapacity} - N_{\text{logical}},\; S_{\text{healthy}} - \max(S_{\text{phys\_occupied}}, N_{\text{logical}})\Big)$$
4. **Máy trạng thái & Vòng đời phiên (Session Lifecycle & State Machine)**:
   - Chuyển dịch trạng thái nghiêm ngặt: `PENDING_ENTRY` $\rightarrow$ `ACTIVE` $\rightarrow$ `PENDING_EXIT` $\rightarrow$ `COMPLETED`, hoặc `CANCELLED`.
   - Đồng bộ nguyên tử giữa Entry Timeout và Xác nhận qua cổng bằng khóa dòng `FOR UPDATE`.
   - Vết kiểm toán vận hành thủ công (`isManualEntry`, `manualEntryReason`, `manualEntryOperatorId`, `isManualExit`, `manualExitReason`, `manualExitOperatorId`).
   - Tuyệt đối cấm can thiệp phần cứng hoặc gửi lệnh điều khiển servo/gate qua MQTT trong Phase 3.
5. **Hạ tầng Idempotency Middleware**:
   - Sử dụng bảng `idempotency_keys` của PostgreSQL để phân xử tranh chấp đồng thời, trả về bản sao bộ nhớ cache (`X-Idempotency-Replay: true`), từ chối payload không khớp (`422 Unprocessable Entity`), và chặn xung đột đang xử lý (`409 Conflict`).
6. **Bộ REST API CMS**:
   - 8 endpoints trên tiền tố `/api/parking-sessions`: tìm kiếm phân trang, lọc xe trong bãi, lấy chi tiết, vào thủ công, tính trước/chốt cước, xác nhận thu tiền, xuất bãi thủ công, hủy phiên chờ.
   - Xác thực bắt buộc qua JWT Bearer token và Zod schema validation.

---

## 2. BẰNG CHỨNG KIỂM TRA & THỰC THI HỆ THỐNG (VERIFICATION EVIDENCE)

### 2.1 Kiểm tra trạng thái Migration CSDL (Prisma Migrate Status)

```bash
$ cd backend && npx prisma migrate status
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "smart_parking_db", schema "public" at "localhost:5432"

4 migrations found in prisma/migrations:
  - 20261105140549_init_foundation
  - 20261106003635_domain_modeling_phase1
  - 20261106021903_parking_slot_extension
  - 20261106171541_parking_session_lifecycle

Database schema is up to date!
```
*Kết quả*: **PASS** (4/4 migrations tuyến tính, sạch sẽ).

### 2.2 Kiểm tra biên dịch TypeScript (Strict Mode)

```bash
$ cd backend && npm run typecheck
> smart-parking-backend@0.1.0 typecheck
> tsc --noEmit
Exit code: 0
```
*Kết quả*: **PASS** (0 lỗi cú pháp và kiểu dữ liệu).

### 2.3 Kiểm tra chuẩn mã nguồn (ESLint)

```bash
$ cd backend && npm run lint
> smart-parking-backend@0.1.0 lint
> eslint .
Exit code: 0
```
*Kết quả*: **PASS** (0 errors, 0 warnings).

### 2.4 Kiểm thử tự động toàn diện Backend (Vitest Test Suite)

Tất cả 18 tệp tin kiểm thử bao gồm các bài test từ Pha 0 đến Pha 3 và kiểm thử đồng thời trên PostgreSQL thực tế:

```bash
$ cd backend && npm test
> smart-parking-backend@0.1.0 test
> vitest run

 RUN  v3.2.7 C:/Users/Vinh Nguyen/IOT/backend

 ✓ tests/session-lifecycle.test.ts (10 tests)
 ✓ tests/session-concurrency.test.ts (3 tests)
 ✓ tests/parking-session-api.test.ts (6 tests)
 ✓ tests/admission-capacity.test.ts (4 tests)
 ✓ tests/billing-calculator.test.ts (9 tests)
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
      Tests  94 passed (94)
   Start at  00:36:18
   Duration  13.21s
Exit code: 0
```
*Kết quả*: **PASS** (94/94 tests đạt 100%, 0 bài trượt, không xảy ra hồi quy).

### 2.5 Kiểm tra biên dịch Backend (Production Build)

```bash
$ cd backend && npm run build
> smart-parking-backend@0.1.0 build
> tsc
Exit code: 0
```
*Kết quả*: **PASS**.

### 2.6 Kiểm tra hồi quy Frontend (Frontend Build Reproducibility)

```bash
$ cd frontend && npm run build
> smart-parking-cms@0.1.0 build
> tsc -b && vite build

vite v6.4.5 building for production...
✓ 1709 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.55 kB │ gzip:   0.37 kB
dist/assets/index-BpV4LKxx.css   19.79 kB │ gzip:   4.42 kB
dist/assets/index-tkFbNodF.js   367.15 kB │ gzip: 119.79 kB
✓ built in 7.39s
Exit code: 0
```
*Kết quả*: **PASS**.

### 2.7 Kiểm tra tính lặp lại của Script Seed dữ liệu (Idempotent Seed Script)

```bash
$ cd backend && npm run prisma:seed
🌱 Bắt đầu nạp dữ liệu mẫu (Seeding development data)...
✅ [User] operator@smartparking.local (OPERATOR) - Mật khẩu đã mã hóa bcrypt
✅ [ParkingLot] Bãi Đỗ Xe Đại Học - Khu A (Sức chứa: 100)
✅ [Vehicle] 51A-12345 (CAR)
✅ [Vehicle] 59B1-98765 (MOTORBIKE)
✅ [Vehicle] 51G-88888 (CAR)
✅ [RFIDCard] UID: E20000190600 -> Gán xe: 51A-12345
✅ [RFIDCard] UID: E20000190601 -> Gán xe: 59B1-98765
✅ [RFIDCard] UID: E20000190603 -> Gán xe: 51G-88888
✅ [RFIDCard] UID: E20000190602 (Thẻ vãng lai chưa gán trước)
✅ [PricingRule] CAR - PER_HOUR: 15000 VND
✅ [PricingRule] MOTORBIKE - PER_VISIT: 5000 VND
✅ [Device] GATE_IN_01 (GATE_ENTRY) - Status: ONLINE
✅ [Device] SENSOR_NODE_01 (SENSOR_NODE) - Status: ONLINE
✅ [ParkingSlot] Slot: A-01 - OpStatus: AVAILABLE
✅ [ParkingSlot] Slot: A-02 - OpStatus: AVAILABLE
✅ [ParkingSlot] Slot: A-03 - OpStatus: MAINTENANCE
✅ [ParkingSlot] Slot: B-01 -> Cảm biến: SENSOR_NODE_01 (Kênh: 1)
✅ [ParkingSession] COMPLETED: 10000000-0000-0000-0000-000000000001 (51A-12345) - Thu: 30,000 VND
✅ [ParkingSession] ACTIVE: 10000000-0000-0000-0000-000000000002 (59B1-98765)
✅ [ParkingSession] PENDING_EXIT: 10000000-0000-0000-0000-000000000003 (51G-88888) - Đã thu: 45,000 VND
🎉 Nạp dữ liệu mẫu hoàn tất thành công!
Exit code: 0
```
*Kết quả*: **PASS** (100% idempotent, cung cấp sẵn dữ liệu các phiên COMPLETED, ACTIVE và PENDING_EXIT phục vụ trực quan trên CMS).

---

## 3. CHI TIẾT TÀI CHÍNH & VÒNG ĐỜI NGHIỆP VỤ (KEY ARCHITECTURAL HIGHLIGHTS)

### 3.1 Bảng mã lỗi nghiệp vụ mới (Phase 3 Error Codes)

| Mã lỗi | HTTP Status | Ý nghĩa nghiệp vụ |
| :--- | :---: | :--- |
| `PARKING_LOT_FULL` | 400 | Bãi đỗ xe đã hết chỗ an toàn theo thuật toán bảo thủ |
| `SESSION_NOT_FOUND` | 404 | Không tìm thấy phiên gửi xe theo ID |
| `ACTIVE_SESSION_EXISTS` | 409 | Phương tiện hoặc thẻ RFID đang có phiên chưa hoàn tất |
| `INVALID_SESSION_STATE_TRANSITION` | 400 | Chuyển dịch trạng thái vi phạm quy tắc máy trạng thái |
| `PAYMENT_REQUIRED` | 400 | Xe chưa thanh toán cước phí hoặc còn thiếu tiền |
| `PAYMENT_ALREADY_CONFIRMED` | 400 | Phiên gửi xe đã được thanh toán đủ cước phí |
| `PAYMENT_AMOUNT_MISMATCH` | 400 | Số tiền thu không khớp với khoản nợ còn thiếu |
| `ADDITIONAL_PAYMENT_REQUIRED` | 400 | Xe nán lại quá hạn ân hạn rời bãi, phát sinh phụ thu |
| `CANNOT_CANCEL_NON_PENDING_SESSION` | 400 | Chỉ có thể hủy phiên đang ở trạng thái PENDING_ENTRY |
| `SESSION_ALREADY_CANCELLED` | 400 | Phiên chờ vào đã bị hủy hoặc hết hạn chờ |
| `PRICING_RULE_NOT_CONFIGURED` | 404 | Bãi xe chưa cấu hình biểu giá cho loại phương tiện này |
| `VEHICLE_DEPARTURE_NOT_CONFIRMED` | 400 | Chưa xác nhận xe đã thực tế rời bãi an toàn |
| `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` | 422 | Cùng Idempotency-Key nhưng nội dung yêu cầu khác nhau |
| `IDEMPOTENCY_KEY_IN_PROGRESS` | 409 | Yêu cầu cùng khóa đang trong quá trình xử lý |

### 3.2 Quy trình chống mất tiền & Quản lý phụ thu quá hạn rời bãi

```
[Xe vào bãi] 
     │
     ▼
[ACTIVE] ──(Khách chuẩn bị về)──► [POST /calculate-fee] (Chốt cước, cutoffTime = now)
                                           │
                                           ▼
                                 [POST /confirm-payment] (Thu tiền đợt 1, chuyển PENDING_EXIT)
                                           │
                                           ▼
                                   [Xe ra cổng barrier]
                                           │
                       ┌───────────────────┴───────────────────┐
                       │                                       │
            (Trong 10 phút ân hạn)                  (Quá 10 phút ân hạn)
                       │                                       │
                       ▼                                       ▼
            [POST /manual-exit]                   [POST /manual-exit]
            Trạng thái -> COMPLETED               Phát hiện phụ thu quá hạn
                                                  Chuyển session -> UNPAID, totalFee tăng
                                                  Ném lỗi: ADDITIONAL_PAYMENT_REQUIRED
                                                               │
                                                               ▼
                                                  [POST /confirm-payment] (Thu tiền đợt 2)
                                                               │
                                                               ▼
                                                  [POST /manual-exit]
                                                  Trạng thái -> COMPLETED (Đủ 2 đợt thu)
```

---

## 4. TỔNG KẾT VÀ BẢO TOÀN GIT

- Toàn bộ các yêu cầu của Pha 3 đã hoàn thành vượt mức tiêu chuẩn.
- Đạt 94/94 automated tests (tăng thêm 35 tests mới so với 59 tests của Phase 2).
- Không có bất kỳ lệnh phá hủy Git nào. Mã nguồn sạch, sẵn sàng thực hiện commit chuẩn quy ước và push đồng bộ lên GitHub remote (`ylc3205/IOT`).

**KẾT LUẬN CUỐI CÙNG**: **PHASE_3_BUILD: PASS**.
