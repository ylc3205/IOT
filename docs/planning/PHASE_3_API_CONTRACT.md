# HỢP ĐỒNG GIAO TIẾP REST API PHA 3 (PHASE 3 API CONTRACT - FINAL)
## QUẢN LÝ PHIÊN, TÍNH PHÍ, LỊCH SỬ THANH TOÁN & IDEMPOTENCY

> [!NOTE]
> Tài liệu này chuẩn hóa toàn bộ các Endpoint HTTP REST dành cho CMS và các hàm Service nội bộ dùng chung, quy chuẩn tiêu đề Idempotency và cấu trúc phản hồi chi tiết về số tiền cần thu.

---

## 1. QUY CHUẨN KỸ THUẬT CHUNG

- **Base URL**: `/api/parking-sessions`
- **Xác thực**: Yêu cầu Header `Authorization: Bearer <JWT_TOKEN>` trên tất cả endpoints.
- **Tiêu đề Idempotency**: Hỗ trợ `Idempotency-Key: <UUID>` trên toàn bộ các phương thức `POST` làm thay đổi trạng thái dữ liệu.
- **Định dạng phản hồi thành công**:
  ```json
  { "success": true, "data": {} }
  ```
- **Định dạng phản hồi thất bại**:
  ```json
  { "success": false, "error": { "code": "ERROR_CODE", "message": "Thông báo chi tiết", "details": {} } }
  ```

---

## 2. DANH SÁCH ENDPOINTS REST API CHO CMS

### 2.1 Xem danh sách phiên gửi xe (`GET /api/parking-sessions`)
- **Query Parameters**: `page`, `limit`, `status`, `parkingLotId`, `vehicleType`, `paymentStatus`, `search`, `startDate`, `endDate`.
- **Response 200 OK**: Trả về danh sách phân trang kèm các trường tài chính `totalFee`, `paidAmount`, `amountDue`.

---

### 2.2 Xem chi tiết một phiên gửi xe (`GET /api/parking-sessions/:id`)
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "data": {
      "id": "c1f7a28e-5b12-4c22-9694-87cfd6741764",
      "parkingLot": { "id": "...", "name": "Bãi Đỗ Xe Đại Học - Khu A" },
      "vehicle": { "id": "...", "licensePlate": "51A12345", "vehicleType": "CAR" },
      "rfidCard": { "id": "...", "uid": "E20000190600" },
      "entryTime": "2026-11-06T08:00:00.000Z",
      "billingCutoffTime": "2026-11-06T10:14:00.000Z",
      "durationMinutes": 134,
      "billableHours": 3,
      "totalFee": "45000.00",
      "paidAmount": "45000.00",
      "amountDue": "0.00",
      "paymentStatus": "PAID",
      "exitTime": null,
      "status": "PENDING_EXIT",
      "payments": [
        {
          "id": "p-01",
          "amount": "45000.00",
          "paymentTime": "2026-11-06T10:15:00.000Z",
          "paymentType": "CASH",
          "note": "INITIAL_PAYMENT",
          "operator": { "id": "...", "fullName": "Nguyễn Văn A" }
        }
      ]
    }
  }
  ```

---

### 2.3 Vào bãi thủ công (`POST /api/parking-sessions/manual-entry`)
- **Request Headers**: `Idempotency-Key: <UUID>` (Khuyến nghị)
- **Request Body**:
  ```json
  {
    "parkingLotId": "00000000-0000-0000-0000-000000000001",
    "licensePlate": "51A-999.88",
    "vehicleType": "CAR",
    "manualEntryReason": "Đầu đọc RC522 cổng vào bảo trì, nhân viên kiểm tra thẻ và mở cổng cơ khí",
    "rfidCardUid": "E20000190605"
  }
  ```
- **Xử lý**:
  - Áp dụng Thuật toán Tiếp nhận Bảo thủ trong một giao dịch đơn có khóa dòng `SELECT FOR UPDATE`.
  - Tạo phiên ở trạng thái `ACTIVE`, `isManualEntry = true`, gán `manualEntryOperatorId = req.user.id`.
  - Tuyệt đối không gửi lệnh mở barrier qua MQTT.
- **Response 201 Created**: Dữ liệu phiên vừa tạo.

---

### 2.4 Xem trước & Tính toán cước phí (`POST /api/parking-sessions/:id/calculate-fee`)
- **Mục đích**: Chốt mốc thời gian tính cước (`billingCutoffTime = NOW()`), chuyển phiên sang `PENDING_EXIT` và tính toán số tiền còn thiếu (`amountDue`).
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "c1f7a28e-5b12-4c22-9694-87cfd6741764",
      "entryTime": "2026-11-06T08:00:00.000Z",
      "billingCutoffTime": "2026-11-06T10:15:00.000Z",
      "durationMinutes": 135,
      "billableHours": 3,
      "pricingType": "PER_HOUR",
      "pricingRate": "15000.00",
      "totalFee": "45000.00",
      "paidAmount": "0.00",
      "amountDue": "45000.00",
      "paymentStatus": "UNPAID"
    }
  }
  ```

---

### 2.5 Xác nhận thu tiền mặt (`POST /api/parking-sessions/:id/confirm-payment`)
- **Mục đích**: Nhân viên thu ngân ghi nhận số tiền mặt nhận từ khách hàng. Hỗ trợ thu đợt đầu và phụ thu quá giờ mà không bao giờ thu trùng.
- **Request Headers**: `Idempotency-Key: <UUID>`
- **Request Body**:
  ```json
  {
    "amount": 45000,
    "note": "INITIAL_PAYMENT"
  }
  ```
- **Xử lý nghiệp vụ**:
  1. Tính toán `amountDue = totalFee - paidAmount`.
  2. Xác minh `amount == amountDue`.
  3. Cập nhật trong transaction:
     - `paidAmount = paidAmount + amount`.
     - `paymentStatus = (paidAmount >= totalFee) ? 'PAID' : 'UNPAID'`.
     - Ghi thêm một bản ghi vào `parking_session_payments`.
  4. **Phiên vẫn giữ nguyên trạng thái `PENDING_EXIT` (hoặc `ACTIVE`)**, không đóng phiên.
- **Response 200 OK**: Trả về dữ liệu phiên và phiếu thu thanh toán vừa ghi.

---

### 2.6 Ra bãi thủ công (`POST /api/parking-sessions/:id/manual-exit`)
- **Mục đích**: Nhân viên xác nhận xe đã rời bãi an toàn, đóng phiên đỗ mà không điều khiển phần cứng.
- **Request Headers**: `Idempotency-Key: <UUID>`
- **Request Body**:
  ```json
  {
    "manualExitReason": "Khách đã trả đủ tiền mặt tại quầy, nhân viên quan sát xe đã rời cổng an toàn",
    "vehicleDepartedConfirmed": true
  }
  ```
- **Ràng buộc chuyển đổi trạng thái**:
  1. **Nguồn hợp lệ**: Chỉ cho phép gọi từ `ACTIVE` hoặc `PENDING_EXIT`. Cấm gọi từ `PENDING_ENTRY`, `COMPLETED`, `CANCELLED` (Trả về 400 `INVALID_SESSION_STATE_TRANSITION`).
  2. **Xác nhận xe rời bãi**: Bắt buộc `vehicleDepartedConfirmed: true`.
  3. **Kiểm tra tài chính**: Bắt buộc $\text{amountDue} == 0$ VÀ $\text{paymentStatus} \in [\text{'PAID'}, \text{'EXEMPT'}]$. Nếu còn nợ tiền, từ chối với 400 `PAYMENT_REQUIRED` kèm số tiền còn thiếu.
  4. Cập nhật `status = 'COMPLETED'`, `exitTime = NOW()`, `isManualExit = true`, `manualExitOperatorId = req.user.id`, `manualExitReason`.
- **Response 200 OK**: Phiên kết thúc thành công.

---

### 2.7 Hủy phiên vào / Xử lý Timeout (`POST /api/parking-sessions/:id/cancel-entry`)
- **Mục đích**: Hủy bỏ phiên đang chờ vào (`PENDING_ENTRY`) do xe lùi lại hoặc do tác vụ Entry Timeout quét định kỳ.
- **Request Body**:
  ```json
  {
    "cancelReason": "ENTRY_TIMEOUT_EXPIRED"
  }
  ```
- **Xử lý**: Chỉ cho phép khi `status === 'PENDING_ENTRY'`. Chuyển sang `CANCELLED`, giải phóng xe và thẻ khỏi Partial Unique Index.
- **Response 200 OK**.

---

## 3. CÁC HÀM SERVICE NỘI BỘ (DÀNH CHO MQTT WORKER PHA 4)

1. `requestEntry(input: { parkingLotId: string; cardUid: string; deviceId: string }): Promise<ParkingSession>`
2. `confirmEntryPassage(sessionId: string): Promise<ParkingSession>` (Idempotent: nếu đã `ACTIVE` thì no-op trả về kết quả).
3. `cancelExpiredEntrySession(sessionId: string): Promise<void>` (Sử dụng khóa dòng `FOR UPDATE` tuần tự hóa với `confirmEntryPassage`).
4. `requestExit(input: { parkingLotId: string; cardUid: string; deviceId: string }): Promise<{ session: ParkingSession; totalFee: Decimal; amountDue: Decimal }>`
5. `confirmExitPassage(sessionId: string): Promise<ParkingSession>` (Kiểm tra thời gian ân hạn 10 phút, nếu quá hạn phát sinh giờ mới thì chặn xe và yêu cầu phụ thu).
6. `executeConservativeAdmission(tx: PrismaTransactionClient, parkingLotId: string): Promise<void>`
