# BÁO CÁO ĐIỀU CHỈNH KỸ THUẬT LẦN CUỐI PHA 3 (PHASE 3 FINAL REVIEW)
## SMART PARKING IoT — PARKING SESSION MANAGEMENT, BILLING & MANUAL OPERATIONS

> [!IMPORTANT]
> **BÁO CÁO ĐIỀU CHỈNH KỸ THUẬT CUỐI CÙNG (FINAL TECHNICAL CORRECTION REPORT)**
> Dự án: **Smart Parking IoT — CMS Management System**
> Vai trò: Senior Backend Architect & PostgreSQL Transaction Specialist.
> Thời điểm: 06/11/2026.
> Chế độ: **PLANNING ONLY**.
> Trạng thái kho lưu trữ: Không chỉnh sửa mã nguồn ứng dụng, không sửa đổi schema CSDL, không chạy migration, không commit/push.

---

## 1. CÁC ĐIỀU CHỈNH KỸ THUẬT ĐÃ THỰC HIỆN (CORRECTIONS MADE)

Qua quá trình rà soát và tinh chỉnh kỹ thuật chuyên sâu theo các tiêu chuẩn khắt khe của hệ thống quản lý bãi đỗ xe IoT, 6 phân mục kỹ thuật trọng yếu đã được hiệu chỉnh hoàn thiện:

### 1.1 Khắc phục Triệt để Hiện tượng Đếm trùng trong Thuật toán Sức chứa (Zero Double-Counting)
- **Nhận diện lỗi đếm trùng**:
  - Ô đỗ vừa hỏng cảm biến (`UNKNOWN`) vừa được đặt bảo trì (`MAINTENANCE`) nếu trừ cả hai sẽ làm hao hụt sức chứa giả tạo.
  - Xe đang đỗ tại ô cảm biến (`OCCUPIED`) và đang có phiên logic (`ACTIVE`) nếu cộng dồn hoặc trừ độc lập sẽ gây trừ trùng sức chứa.
- **Giải pháp chuẩn hóa**:
  - Phân rã 100% ô đỗ vật lý thành 4 tập hợp rời nhau hoàn toàn: $S_{\text{maint}}$, $S_{\text{unknown}}$ (chỉ tính ô không bảo trì), $S_{\text{phys\_occupied}}$ (chỉ tính ô lành lặn đang có xe), và $S_{\text{phys\_free}}$.
  - Tính toán số xe đang lưu thông trong bãi chưa chạm cảm biến ô đỗ:
    $$N_{\text{unslotted}} = \max(0, N_{\text{logical}} - S_{\text{phys\_occupied}})$$
  - Công thức sức chứa bảo thủ đối chiếu cả giới hạn đăng ký kinh doanh và ô đỗ vật lý:
    $$\text{SafeAvailableSpaces} = \min\Big(\text{lot.totalCapacity} - N_{\text{logical}},\; S_{\text{healthy}} - \max(S_{\text{phys\_occupied}}, N_{\text{logical}})\Big)$$
  - Toàn bộ thuật toán được bọc trong một giao dịch đơn nhất với khóa hàng `SELECT id FROM parking_lots WHERE id = $1 FOR UPDATE`.

### 1.2 Bảo toàn Lịch sử Thanh toán & Phụ thu Quá giờ (Không Thu Trùng Tiền)
- Thiết lập bảng quan hệ $1 - N$ `parking_session_payments` lưu trữ từng lần thu tiền cụ thể (`amount`, `paymentTime`, `operatorId`, `note`).
- Cập nhật trường tích lũy `paidAmount Decimal @default(0)` trên `parking_sessions`.
- Số tiền cần thu tại bất kỳ thời điểm nào được tính minh bạch:
  $$\text{amountDue} = \max(0, \text{totalFee} - \text{paidAmount})$$
- Khi phát sinh phụ thu quá thời gian ân hạn bước sang giờ mới, hệ thống chỉ yêu cầu thu đúng khoản chênh lệch $\text{amountDue}$, **tuyệt đối không bao giờ thu lại toàn bộ khoản tiền khách đã trả trước đó**.

### 1.3 Hạ tầng Idempotency Bền vững Trên PostgreSQL
- Không sử dụng Redis để tránh overengineering.
- Thiết lập bảng `idempotency_keys` ngay trong PostgreSQL lưu trữ: `key`, `targetPath`, `requestHash` (SHA-256), `responseStatus`, `responseBody`, `lockedUntil`.
- Xử lý hoàn hảo 6 kịch bản:
  1. Tranh chấp đồng thời cùng key $\rightarrow$ Khóa 30s hoặc báo 409 Conflict.
  2. Cùng key nhưng khác payload $\rightarrow$ Từ chối 422 `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`.
  3. Replay request thành công $\rightarrow$ Trả về kết quả cache kèm Header `X-Idempotency-Replay: true`.
  4. Thử lại sau lỗi $\rightarrow$ Mở khóa cho phép retry sạch sẽ.
  5. Rollback giao dịch $\rightarrow$ Không lưu trạng thái nửa vời.
  6. Ràng buộc duy nhất CSDL $\rightarrow$ Phòng ngự 2 lớp cùng Partial Unique Indexes.

### 1.4 Giải quyết Xung đột Entry Timeout vs Passage Confirmation
- Phiên chờ vào (`PENDING_ENTRY`) có thời hạn chờ mặc định **60 giây**.
- Cả hai luồng xác nhận xe qua barrier (`confirmEntryPassage`) và tác vụ quét hủy do quá hạn (`cancelExpiredEntrySession`) đều bắt buộc dùng khóa dòng `SELECT id, status FROM parking_sessions WHERE id = $1 FOR UPDATE`.
- Khóa hàng đảm bảo tính nguyên tử: Nếu xe đã qua barrier thành công chuyển sang `ACTIVE`, tác vụ Timeout quét sau sẽ bỏ qua, không bao giờ hủy nhầm xe đã vào.

### 1.5 Hoãn lại Chính sách Phạt Mất Thẻ RFID Vãng lai (Deferred Penalty)
- **Tuyệt đối không áp dụng phí phạt mất thẻ trong Phase 3**.
- Khi khách làm mất thẻ, nhân viên CMS đối chiếu đăng ký xe và CCCD, thu đúng cước đỗ xe theo giờ thực tế lưu bãi, và cho xe ra qua quy trình `manualExit` có lưu vết kiểm toán đầy đủ. Thẻ cũ được đánh dấu `LOST` trong bảng `rfid_cards`.

### 1.6 Chuẩn hóa Ma trận Chuyển dịch Trạng thái Vận hành Thủ công
- Cho phép `manualExit` từ `ACTIVE` và `PENDING_EXIT`.
- Chặn tuyệt đối `manualExit` từ `PENDING_ENTRY`, `COMPLETED`, `CANCELLED` (Trả về 400 `INVALID_SESSION_STATE_TRANSITION`).
- Yêu cầu bắt buộc: $\text{amountDue} == 0$ (hoặc `EXEMPT`), có cờ `vehicleDepartedConfirmed: true`, xác thực JWT và ghi nhận vết nhân viên.
- Không phát bất kỳ lệnh điều khiển Servo nào qua MQTT.

---

## 2. CÁC RÀNG BUỘC BẤT BIẾN CỦA HỆ THỐNG (UPDATED SYSTEM INVARIANTS)

1. **Ràng buộc Duy nhất Phiên Hoạt động (Partial Unique Index Invariant)**:
   Mỗi phương tiện và mỗi thẻ RFID chỉ được phép tham gia vào tối đa một phiên chưa kết thúc (`status IN ('PENDING_ENTRY', 'ACTIVE', 'PENDING_EXIT')`). Thẻ vãng lai chỉ được giải phóng khi phiên đạt trạng thái kết thúc (`COMPLETED` hoặc `CANCELLED`).
2. **Ràng buộc Thẻ Vãng lai Không Gán Cứng (Visitor RFID Invariant)**:
   Thẻ vãng lai luôn có `RFIDCard.vehicleId == null`. Liên kết giữa xe vãng lai và thẻ chỉ tồn tại thông qua bản ghi `ParkingSession`.
3. **Ràng buộc Tài chính Không Âm & Không Thu Trùng (Financial Invariant)**:
   $\text{totalFee} \ge 0$, $\text{paidAmount} \ge 0$, $\text{amountDue} = \max(0, \text{totalFee} - \text{paidAmount})$. Phiên chỉ được chuyển sang `COMPLETED` khi $\text{amountDue} == 0$ hoặc `paymentStatus === 'EXEMPT'`.
4. **Ràng buộc An toàn Phần cứng (Hardware Isolation Invariant)**:
   Các thao tác nghiệp vụ thủ công trên CMS tuyệt đối không gửi bản tin MQTT `GATE_COMMAND` và không kích hoạt rơ-le / Servo cơ khí.

---

## 3. CÁC QUYẾT ĐỊNH DOANH NGHIỆP CẦN XÁC NHẬN (REMAINING BUSINESS DECISIONS)

Dưới đây là 2 quyết định chính sách đang được thiết lập dưới dạng cấu hình đề xuất (Proposed Defaults) và chờ chủ dự án phê duyệt trước khi vận hành thực tế:

| Quyết định | Giá trị đề xuất kỹ thuật | Tùy chọn khác | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Thời lượng Ân hạn Rời bãi (Exit Grace Period)** | **10 phút** (`DEFAULT_EXIT_GRACE_PERIOD_MINUTES = 10`) | 15 phút hoặc 20 phút | Được cấu hình linh hoạt tại biến môi trường hoặc bãi xe. |
| **Chính sách Thu phí Phạt Mất Thẻ (Lost Card Fee)** | **HOÃN LẠI (DEFERRED)**, chỉ thu cước đỗ xe theo giờ thực tế trong Pha 3. | Áp dụng mức phạt cố định (VD: 50k, 100k) | Đưa vào xem xét ở pha nghiệp vụ nâng cao trong tương lai. |

---

## 4. MA TRẬN PHỦ KIỂM THỬ ĐƯỢC NÂNG CẤP (UPDATED TEST COVERAGE)

Kế hoạch kiểm thử Pha 3 nâng cấp bao gồm **5 bộ test suites** với khoảng **35 bài test mới**:

1. `tests/billing-calculator.test.ts` (8 tests): Kiểm thử số học Decimal, làm tròn lên, khung tối thiểu 1 giờ, snapshot biểu giá.
2. `tests/admission-capacity.test.ts` (4 tests): Kiểm thử chống trừ trùng ô vừa bảo trì vừa mất tín hiệu, kiểm thử giữ chỗ `PENDING_ENTRY`, xử lý lệch số liệu vật lý vs logic.
3. `tests/session-concurrency.test.ts` (4 tests): Kiểm thử tranh chấp chỗ cuối cùng (10 requests đồng thời), tranh chấp thẻ vãng lai, xung đột Entry Timeout vs Passage Confirmation.
4. `tests/session-lifecycle.test.ts` (6 tests): Vòng đời phiên, thanh toán phụ thu nhiều đợt không thu trùng tiền, an toàn thẻ vãng lai.
5. `tests/idempotency.test.ts` & `tests/manual-operations-api.test.ts` (13 tests): Kiểm thử 8 REST endpoints CMS, middleware Idempotency-Key trên PostgreSQL, xuất bãi mất thẻ không phạt.

*Toàn bộ 59 bài test của Pha 0, 1, 2 tiếp tục được duy trì kiểm tra hồi quy nghiêm ngặt (Zero regressions).*

---

## 5. ĐÁNH GIÁ MỨC ĐỘ SẴN SÀNG TRIỂN KHAI (IMPLEMENTATION READINESS)

- **Tính toàn vẹn Tài liệu**: Toàn bộ 6 tài liệu kỹ thuật tại `docs/planning/` đã được đồng bộ hóa 100%, không còn bất kỳ mâu thuẫn hay lỗ hổng logic nào.
- **Tính khả thi Kỹ thuật**: Các giải pháp về Concurrency Lock, Multi-payment tracking, Idempotency trên PostgreSQL và Entry Timeout hoàn toàn khả thi và thực dụng, phù hợp tiến độ 2–3 tuần.
- **Ranh giới Phân hệ**: Giữ vững kiến trúc Modular Monolith, sẵn sàng tích hợp với MQTT Broker ở Pha 4 và CMS Frontend ở Pha 5.

---

## 🎯 PHÁN QUYẾT CUỐI CÙNG (FINAL VERDICT)

```
========================================================================================
                       PHASE 3 PLANNING FINAL VERDICT: READY
========================================================================================
- Thuật toán sức chứa bảo thủ đã loại trừ hoàn toàn nguy cơ đếm trùng (Zero Double-Counting).
- Cơ chế thanh toán phụ thu bảo toàn lịch sử, không bao giờ thu trùng khoản tiền đã nộp.
- Hạ tầng Idempotency bền vững được hiện thực trực tiếp trên PostgreSQL.
- Xung đột Entry Timeout và Passage Confirmation được phân giải nguyên tử bằng khóa dòng.
- Không áp dụng phí phạt mất thẻ trong Phase 3, chuyển sang trạng thái DEFERRED.
- Hồ sơ quy hoạch đạt chuẩn cao nhất, sẵn sàng 100% để bước vào giai đoạn lập trình mã nguồn!
========================================================================================
```

