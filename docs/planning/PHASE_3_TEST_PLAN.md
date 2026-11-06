# KẾ HOẠCH KIỂM THỬ TOÀN DIỆN PHA 3 (PHASE 3 TEST PLAN - FINAL)
## MA TRẬN KỊCH BẢN, KIỂM THỬ ĐỒNG THỜI TRÊN POSTGRESQL VÀ TIÊU CHUẨN NGHIỆM THU

> [!NOTE]
> Tài liệu này chuẩn hóa toàn bộ chiến lược kiểm thử tự động cho Pha 3, bổ sung các ca kiểm thử chống trừ trùng sức chứa, kiểm thử cạnh tranh giữa Entry Timeout và Passage Confirmation, kiểm thử Idempotency trên CSDL thật và bảo toàn thanh toán nhiều đợt.

---

## 1. NGUYÊN TẮC VÀ CHIẾN LƯỢC KIỂM THỬ

1. **Thực thi trên PostgreSQL 16 Thực tế (`smart_parking_db`)**:
   - Mọi kiểm thử giao dịch khóa hàng bi quan (`FOR UPDATE`), Partial Unique Index, và bảng `idempotency_keys` phải chạy trực tiếp trên cơ sở dữ liệu thật, tuyệt đối không dùng mock object.
2. **Tính Cô lập Tuyệt đối (Test Isolation)**:
   - Mỗi test file sử dụng tiền tố ngẫu nhiên độc lập (`TEST_P3_${Date.now()}_...`). Tự động dọn dẹp sạch sẽ trong `afterAll()`.
3. **Phân tầng 5 Bộ Kiểm thử Độc lập**:
   - `tests/billing-calculator.test.ts`: Động cơ tính phí và snapshot.
   - `tests/admission-capacity.test.ts`: Thuật toán sức chứa bảo thủ, kiểm thử chống trừ trùng ô hỏng/bảo trì.
   - `tests/session-concurrency.test.ts`: Tranh chấp chỗ cuối cùng, xung đột Entry Timeout vs Passage, tranh chấp thẻ vãng lai.
   - `tests/session-lifecycle.test.ts`: Vòng đời phiên, thanh toán phụ thu không thu trùng tiền, an toàn thẻ vãng lai.
   - `tests/manual-operations-api.test.ts`: 8 REST endpoints CMS, kiểm thử Idempotency-Key và xử lý mất thẻ không phạt.

---

## 2. MA TRẬN KỊCH BẢN KIỂM THỬ CHI TIẾT

### 2.1 Kiểm thử Thuật toán Sức chứa & Chống Trừ Trùng (`tests/admission-capacity.test.ts`)

| Mã test | Kịch bản kiểm thử | Mô phỏng thực tế | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **ADM-01** | Ô đỗ vừa `MAINTENANCE` vừa `UNKNOWN` | 1 ô đỗ được đặt bảo trì và cảm biến mất kết nối | Chỉ bị trừ 1 lần duy nhất khỏi sức chứa. Không trừ 2 lần. |
| **ADM-02** | Xe có phiên `PENDING_ENTRY` (Reservation) | 1 xe vừa quẹt thẻ cổng vào, chưa vào ô đỗ | Sức chứa khả dụng lập tức giảm 1 suất, chặn xe khác vào nếu hết chỗ. |
| **ADM-03** | Không đồng nhất dữ liệu: Xe lạ chiếm ô không quét thẻ | Có 1 ô báo `OCCUPIED` nhưng không có phiên logic tương ứng | Thuật toán bảo thủ lấy $\max(S_{\text{phys\_occupied}}, N_{\text{logical}})$, giảm sức chứa an toàn. |
| **ADM-04** | Xe đang tìm chỗ (`ACTIVE` nhưng ô vẫn `EMPTY`) | 2 xe vào bãi đang chạy trong làn tìm chỗ | Chỗ trống vật lý bị trừ bù bởi số xe đang tìm chỗ, không cho xe thứ 3 vào nếu bãi chỉ có 2 chỗ. |

---

### 2.2 Kiểm thử Tranh chấp Đồng thời & Khóa dòng trên PostgreSQL (`tests/session-concurrency.test.ts`)

| Mã test | Kịch bản kiểm thử | Mô phỏng thực tế | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **CON-01** | **Tranh chấp chỗ đỗ cuối cùng** | Bãi chỉ còn đúng 1 chỗ trống. Bắn đồng thời 10 request check-in qua `Promise.all` cùng 1 mili-giây | **Chính xác 1 request thành công (201 Created)**, 9 request nhận lỗi 409 `PARKING_LOT_FULL`. Zero overbooking! |
| **CON-02** | **Tranh chấp quẹt cùng 1 thẻ vãng lai** | 2 xe tại 2 cổng cùng quẹt 1 thẻ RFID vãng lai cùng lúc | **Đúng 1 xe tạo phiên thành công**, xe thứ 2 bị chặn bởi `unique_active_rfid_session`. |
| **CON-03** | **Xung đột Entry Timeout vs Confirm Passage** | Xe đi qua barrier tại giây 59.9 trong khi tác vụ Timeout chạy tại giây 60.0 | Khóa `FOR UPDATE` tuần tự hóa: Hoặc xe thành công sang `ACTIVE`, hoặc Timeout hủy thành `CANCELLED`. Không bao giờ bị trạng thái nửa vời. |
| **CON-04** | **Tranh chấp cùng Idempotency-Key** | 2 request gửi đồng thời cùng 1 key | 1 request thực thi, request kia chờ hoặc nhận kết quả tương đương, không tạo bản ghi trùng. |

---

### 2.3 Kiểm thử Thanh toán Phụ thu & Không Thu Trùng Tiền (`tests/session-lifecycle.test.ts`)

| Mã test | Kịch bản kiểm thử | Hành động & Mốc thời gian | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **PAY-01** | Thanh toán lần đầu đầy đủ | Phiên đỗ 1 giờ, phí 15k $\rightarrow$ Nộp 15k | `paidAmount = 15k`, `amountDue = 0`, `paymentStatus = 'PAID'`. Tạo 1 bản ghi thanh toán. |
| **PAY-02** | Quá hạn ân hạn 10 phút bước sang giờ thứ 2 | Xe nán lại bãi 45 phút sau thanh toán đợt 1 | `totalFee` tăng lên 30k. `paidAmount` vẫn là 15k. `amountDue = 15k`. `paymentStatus = 'UNPAID'`. Chặn xuất bãi! |
| **PAY-03** | **Thu phụ thu không thu trùng tiền** | Thu ngân thu đúng số tiền còn thiếu (15k) | Ghi thêm bản ghi thanh toán thứ 2 (15k). `paidAmount = 30k`. `amountDue = 0`. Xuất bãi thành công. **Khách hàng không bị thu 30k lần hai!** |
| **PAY-04** | Xuất bãi trong thời gian ân hạn 10 phút | Rời bãi tại phút thứ 8 sau thanh toán | Cho xe xuất bãi ngay, không phát sinh thêm phí. |

---

### 2.4 Kiểm thử Vận hành Thủ công & Xử lý Mất Thẻ Không Thu Phạt (`tests/manual-operations-api.test.ts`)

| Mã test | Kịch bản kiểm thử | Hành động & Điều kiện | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **MAN-01** | Ra bãi thủ công từ `ACTIVE` | Đã thanh toán đầy đủ $\rightarrow$ Gọi `manualExit` | Chuyển sang `COMPLETED`, `isManualExit = true`. |
| **MAN-02** | Ra bãi thủ công từ `PENDING_EXIT` | Đã thanh toán đầy đủ $\rightarrow$ Gọi `manualExit` | Chuyển sang `COMPLETED`. |
| **MAN-03** | Cấm ra bãi thủ công từ `PENDING_ENTRY` | Cố gọi `manualExit` trên phiên chờ vào | Bị từ chối với lỗi 400 `INVALID_SESSION_STATE_TRANSITION`. |
| **MAN-04** | Cấm ra bãi thủ công khi phiên đã `COMPLETED` | Cố gọi `manualExit` trên phiên đã xong | Bị từ chối với lỗi 400 `INVALID_SESSION_STATE_TRANSITION`. |
| **MAN-05** | Cấm ra bãi thủ công khi chưa trả đủ tiền | Còn nợ `amountDue > 0`, gọi `manualExit` | Bị từ chối với lỗi 400 `PAYMENT_REQUIRED` kèm số tiền còn thiếu. |
| **MAN-06** | **Xử lý mất thẻ vãng lai không thu phí phạt** | Khách mất thẻ $\rightarrow$ Đối chiếu giấy tờ $\rightarrow$ Thu cước giờ thực tế | Xuất bãi thành công, không thu phụ phí mất thẻ (chính sách phạt được hoãn lại). Thẻ đánh dấu `LOST`. |

---

### 2.5 Kiểm thử Idempotency trên PostgreSQL (`tests/idempotency.test.ts`)

| Mã test | Kịch bản kiểm thử | Hành động | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **IDM-01** | Phát lại request thành công cùng key & payload | Gửi lại request `manual-entry` với cùng `Idempotency-Key` | Trả về ngay kết quả 201 cũ kèm Header `X-Idempotency-Replay: true`, không tạo bản ghi mới trong CSDL. |
| **IDM-02** | Cùng key nhưng thay đổi payload | Gửi key cũ nhưng thay đổi biển số xe | Bị từ chối với lỗi 422 `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`. |
| **IDM-03** | Thử lại sau khi giao dịch bị rollback | Request đầu gặp lỗi CSDL $\rightarrow$ Client gửi lại | Cho phép thực thi lại sạch sẽ và tạo bản ghi thành công. |

---

## 3. TIÊU CHUẨN NGHIỆM THU CHẤT LƯỢNG

1. **Bộ test Pha 3 mới**: Toàn bộ ~35 bài test mới đạt 100% (Green).
2. **Kiểm tra Hồi quy (Zero Regressions)**: Toàn bộ 59 tests của Pha 0, 1, 2 tiếp tục đạt 100%.
3. **TypeScript & Linter**: `npm run typecheck` 0 lỗi, `npm run lint` 0 lỗi/cảnh báo.
4. **Biên dịch**: `npm run build` Backend và Frontend thành công.
