# THIẾT KẾ MÁY TRẠNG THÁI PHIÊN GỬI XE (PARKING SESSION STATE MACHINE - FINAL)
## CHU KỲ TRẠNG THÁI, TIMEOUT PHIÊN VÀO, PHỤ THU QUÁ GIỜ & AN TOÀN VẬN HÀNH

> [!NOTE]
> Tài liệu này chuẩn hóa toàn bộ chu kỳ trạng thái của một phiên gửi xe (`ParkingSession`), phân giải xung đột giữa Entry Timeout và Passage Confirmation, quy tắc phụ thu quá hạn và rào chắn bảo vệ chuyển dịch trạng thái.

---

## 1. MÔ HÌNH CHUYỂN DỊCH TRẠNG THÁI TỔNG THỂ

```mermaid
stateDiagram-v2
    [*] --> PENDING_ENTRY : Quét thẻ RFID tại cổng vào (requestEntry)
    
    PENDING_ENTRY --> ACTIVE : Xe qua barrier vào bãi an toàn (confirmEntryPassage)
    PENDING_ENTRY --> CANCELLED : Timeout 60s / Hủy lượt vào (cancelEntry)
    
    [*] --> ACTIVE : Vào bãi thủ công qua CMS (manualEntry)

    ACTIVE --> PENDING_EXIT : Bắt đầu tính tiền / Quét thẻ ra (requestExit)
    ACTIVE --> COMPLETED : Ra bãi thủ công từ ACTIVE (manualExit - Đã trả đủ tiền)

    PENDING_EXIT --> PENDING_EXIT : Thu tiền mặt (paidAmount += amount, paymentStatus = PAID)
    PENDING_EXIT --> ACTIVE : Hồi bỏ yêu cầu ra / Lùi xe lại bãi (rollbackExit)
    PENDING_EXIT --> COMPLETED : Xe qua barrier ra trong thời gian ân hạn (confirmExitPassage)
    PENDING_EXIT --> COMPLETED : Ra bãi thủ công từ PENDING_EXIT (manualExit - Đã trả đủ tiền)

    COMPLETED --> [*] : Giải phóng Thẻ & Phương tiện
    CANCELLED --> [*] : Giải phóng Thẻ & Phương tiện
```

---

## 2. PHÂN GIẢI XUNG ĐỘT ENTRY TIMEOUT VÀ CONFIRM PASSAGE

Khi xe quẹt thẻ tại cổng vào, phiên ở trạng thái `PENDING_ENTRY`.
- **Thời hạn chờ**: Mặc định **60 giây** (`ENTRY_TIMEOUT_SECONDS = 60`).
- **Tình huống xung đột (Race Condition)**: Xe thực tế chạy qua barrier tại giây thứ 59.9, trong khi tác vụ quét dọn Timeout chạy tại giây thứ 60.0.

### Cơ chế Tuần tự hóa Giao dịch:
Cả hai tác vụ đều bắt buộc thực hiện trong một giao dịch có khóa hàng bi quan:
```sql
SELECT id, status FROM "parking_sessions" WHERE id = $1 FOR UPDATE;
```
1. **Trường hợp `confirmEntryPassage` giành được khóa trước**:
   - Cập nhật `status = 'ACTIVE'`. Commit!
   - Khi tác vụ Timeout giành được khóa sau, nó đọc thấy `status !== 'PENDING_ENTRY'` $\rightarrow$ **Bỏ qua, không hủy phiên**.
2. **Trường hợp Timeout giành được khóa trước**:
   - Cập nhật `status = 'CANCELLED'`, `cancelReason = 'ENTRY_TIMEOUT_EXPIRED'`. Commit!
   - Khi `confirmEntryPassage` giành được khóa sau, nó đọc thấy `status === 'CANCELLED'` $\rightarrow$ **Từ chối xác nhận và ném lỗi `SESSION_ALREADY_CANCELLED`**. Barrier không mở.

---

## 3. QUY TRÌNH PHỤ THU QUÁ HẠN ÂN HẠN KHÔNG THU TRÙNG TIỀN

```mermaid
sequenceDiagram
    autonumber
    actor Driver as Lái xe
    actor Operator as Nhân viên CMS / Thu ngân
    participant Session as ParkingSession (CSDL)

    Driver->>Operator: Thanh toán đợt 1 (Giờ 1: 15,000 VND)
    Operator->>Session: confirmPayment(15,000)
    Note over Session: totalFee = 15,000, paidAmount = 15,000<br/>amountDue = 0, paymentStatus = 'PAID'<br/>paymentTime = T0
    Session-->>Operator: 200 OK (Đã thanh toán đủ đợt 1)

    Note over Driver,Session: Lái xe nán lại bãi quá 10 phút (Thời gian ân hạn đề xuất)<br/>và bước sang giờ thứ 2

    Driver->>Session: Xe ra cổng / Quét thẻ xuất bãi
    Note over Session: Phát hiện vượt giờ! Tính lại cước: newTotalFee = 30,000<br/>amountDue = 30,000 - 15,000 = 15,000 (KHÔNG THU LẠI 30,000)<br/>paymentStatus = 'UNPAID'
    Session-->>Driver: Chặn barrier ra! Báo lỗi ADDITIONAL_PAYMENT_REQUIRED (Còn thiếu 15,000 VND)

    Driver->>Operator: Nộp thêm 15,000 VND phụ thu
    Operator->>Session: confirmPayment(15,000, note: "OVERTIME_SURCHARGE")
    Note over Session: paidAmount = 15,000 + 15,000 = 30,000<br/>amountDue = 0, paymentStatus = 'PAID'
    Session-->>Operator: 200 OK (Thanh toán hoàn tất đợt 2)

    Operator->>Session: Cho xe xuất bãi (manualExit hoặc confirmExitPassage)
    Note over Session: status = 'COMPLETED' -> Giải phóng thẻ & xe
```

---

## 4. MA TRẬN QUY TẮC CHUYỂN ĐỔI BẤT BIẾN (STATE INVARIANTS)

1. **Quy tắc Ra bãi Thủ công (`manualExit`)**:
   - **HỢP LỆ**: Chỉ được phép gọi từ `ACTIVE` và `PENDING_EXIT`.
   - **BỊ CẤM**: Tuyệt đối từ chối nếu phiên đang ở `PENDING_ENTRY`, `COMPLETED`, `CANCELLED` (Trả về 400 `INVALID_SESSION_STATE_TRANSITION`).
   - **Điều kiện hoàn thành**: Bắt buộc có xác nhận rời bãi (`vehicleDepartedConfirmed: true`) VÀ $\text{amountDue} == 0$ (hoặc `paymentStatus === 'EXEMPT'`).
2. **An toàn Thẻ RFID Vãng lai**:
   - Thẻ bị khóa trong partial unique index suốt các trạng thái `PENDING_ENTRY`, `ACTIVE`, `PENDING_EXIT`.
   - Thẻ **CHỈ ĐƯỢC GIẢI PHÓNG** khi phiên chuyển sang `COMPLETED` hoặc `CANCELLED`.
3. **Chống Ghi đè Trạng thái do Request Lặp (Idempotency State Guard)**:
   - Nếu gọi lại `confirmPayment` với cùng số tiền trên phiên đã thanh toán $\rightarrow$ Trả về 200 OK (no-op).
   - Nếu gọi lại `confirmEntryPassage` trên phiên đã `ACTIVE` $\rightarrow$ Trả về 200 OK (no-op).
   - Không cho phép bất kỳ request nào làm suy đồi (corrupt) trạng thái của phiên.
