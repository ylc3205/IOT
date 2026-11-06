# SMART PARKING IOT — PHASE 2 REST API CONTRACT

## 1. QUY CHUẨN GIAO THỨC & PHẢN HỒI

- **Base URL**: `/api`
- **Mã hóa truyền tải**: JSON (`application/json; charset=utf-8`)
- **Cơ chế xác thực**: HTTP Authorization Header với chuẩn `Bearer <JWT_TOKEN>`
- **Định dạng phản hồi thành công**:
  ```json
  {
    "success": true,
    "data": {}
  }
  ```
- **Định dạng phản hồi thất bại**:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "Thông báo lỗi chi tiết",
      "details": {}
    }
  }
  ```

---

## 2. PHÂN HỆ AUTHENTICATION (`/api/auth`)

### 2.1 Đăng nhập CMS (`POST /api/auth/login`)
- **Quyền hạn**: Công khai (Public)
- **Request Body**:
  ```json
  {
    "email": "operator@smartparking.local",
    "password": "Admin@123456"
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "uuid-v4",
        "email": "operator@smartparking.local",
        "fullName": "Nhân viên Trực cổng",
        "role": "OPERATOR"
      }
    }
  }
  ```
- **Mã lỗi thường gặp**: `AUTH_INVALID_CREDENTIALS` (400), `USER_INACTIVE` (403), `VALIDATION_ERROR` (400).

### 2.2 Xem thông tin tài khoản hiện hành (`GET /api/auth/me`)
- **Quyền hạn**: Yêu cầu Bearer Token
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid-v4",
      "email": "operator@smartparking.local",
      "fullName": "Nhân viên Trực cổng",
      "role": "OPERATOR",
      "isActive": true,
      "createdAt": "2026-11-06T00:00:00.000Z"
    }
  }
  ```

---

## 3. PHÂN HỆ BÃI ĐỖ XE (`/api/parking-lots`)

### 3.1 Danh sách bãi đỗ xe (`GET /api/parking-lots`)
- **Query Params**: `page=1`, `limit=20`, `isActive=true|false`
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "name": "Bãi Đỗ Xe Đại Học - Khu A",
          "location": "Khu A, Tòa nhà Trung tâm Công nghệ",
          "totalCapacity": 100,
          "isActive": true,
          "_count": { "parkingSlots": 4, "devices": 2 }
        }
      ],
      "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
    }
  }
  ```

### 3.2 Chi tiết bãi đỗ xe (`GET /api/parking-lots/:id`)
- **Response 200 OK**: Chi tiết bãi xe kèm danh sách thiết bị và số lượng slots.

### 3.3 Tạo bãi đỗ xe mới (`POST /api/parking-lots`)
- **Request Body**:
  ```json
  {
    "name": "Bãi Đỗ Xe Khu B",
    "location": "Tòa nhà B1",
    "totalCapacity": 80
  }
  ```

### 3.4 Cập nhật bãi đỗ xe (`PATCH /api/parking-lots/:id`)
- **Request Body**: `{ "name"?: string, "location"?: string, "totalCapacity"?: number, "isActive"?: boolean }`

### 3.5 Báo cáo độ lấp đầy (`GET /api/parking-lots/:id/occupancy`)
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "data": {
      "parkingLotId": "00000000-0000-0000-0000-000000000001",
      "parkingLotName": "Bãi Đỗ Xe Đại Học - Khu A",
      "totalCapacity": 4,
      "configuredSlots": 4,
      "available": 3,
      "occupied": 0,
      "maintenance": 1,
      "unknown": 0
    }
  }
  ```

---

## 4. PHÂN HỆ VỊ TRÍ ĐỖ XE (`/api/parking-slots` & `/api/parking-lots/:lotId/slots`)

### 4.1 Danh sách slots theo bãi (`GET /api/parking-lots/:lotId/slots`)
- **Query Params**: `operationalStatus=AVAILABLE|OCCUPIED|MAINTENANCE`, `sensorStatus=EMPTY|OCCUPIED|UNKNOWN`, `isActive=true|false`
- **Response 200 OK**: Mảng danh sách các slot kèm thông tin thiết bị cảm biến liên kết.

### 4.2 Tạo vị trí đỗ mới (`POST /api/parking-lots/:lotId/slots`)
- **Request Body**:
  ```json
  {
    "slotCode": "A-04",
    "sensorDeviceId": "uuid-v4",
    "sensorChannel": 3,
    "operationalStatus": "AVAILABLE"
  }
  ```
- **Ràng buộc kiểm tra**:
  - `sensorDeviceId` và `sensorChannel` phải cùng cung cấp hoặc cùng để trống.
  - Thiết bị cảm biến phải thuộc cùng `lotId`.
  - Cặp `(sensorDeviceId, sensorChannel)` không bị trùng lặp với slot khác (`PARKING_SLOT_SENSOR_CONFLICT`).

### 4.3 Xem chi tiết slot (`GET /api/parking-slots/:id`)

### 4.4 Cập nhật slot (`PATCH /api/parking-slots/:id`)
- **Request Body**: `{ "slotCode"?: string, "sensorDeviceId"?: string | null, "sensorChannel"?: number | null, "operationalStatus"?: string, "isActive"?: boolean }`

---

## 5. PHÂN HỆ PHƯƠNG TIỆN (`/api/vehicles`)

### 5.1 Danh sách phương tiện (`GET /api/vehicles`)
- **Query Params**: `page=1`, `limit=20`, `vehicleType=CAR|MOTORBIKE`, `search=51A`, `isActive=true|false`

### 5.2 Chi tiết phương tiện (`GET /api/vehicles/:id`)
- Bao gồm danh sách thẻ RFID đang gán và lịch sử phiên đỗ.

### 5.3 Đăng ký phương tiện (`POST /api/vehicles`)
- **Request Body**:
  ```json
  {
    "licensePlate": "51A-123.45",
    "vehicleType": "CAR"
  }
  ```
- **Chuẩn hóa tự động**: `licensePlate` được chuẩn hóa thành `51A12345` (viết hoa, lược bỏ ký tự đặc biệt) trước khi kiểm tra trùng lặp và lưu trữ.

### 5.4 Cập nhật phương tiện (`PATCH /api/vehicles/:id`)

---

## 6. PHÂN HỆ THẺ TỪ RFID (`/api/rfid-cards`)

### 6.1 Danh sách thẻ (`GET /api/rfid-cards`)
- **Query Params**: `status=ACTIVE|INACTIVE|LOST|BLOCKED`, `isAssigned=true|false`, `search=UID`

### 6.2 Chi tiết thẻ (`GET /api/rfid-cards/:id`)

### 6.3 Tạo mới thẻ RFID (`POST /api/rfid-cards`)
- **Request Body**:
  ```json
  {
    "uid": "e2:00:00:19:06:00",
    "vehicleId": "uuid-v4-or-null"
  }
  ```
- **Chuẩn hóa tự động**: Mã UID được chuẩn hóa viết hoa Hex (`E20000190600`).

### 6.4 Gán thẻ cho xe (`POST /api/rfid-cards/:id/assign`)
- **Request Body**: `{ "vehicleId": "uuid-v4" }`
- **Ràng buộc an toàn**: Từ chối nếu thẻ đang trong phiên gửi xe chưa hoàn tất (`RFID_ACTIVE_SESSION_EXISTS`).

### 6.5 Hủy gán thẻ (`POST /api/rfid-cards/:id/unassign`)
- Chuyển thẻ về mô hình thẻ vãng lai (`vehicleId = null`). Từ chối nếu thẻ đang trong phiên đỗ dở dang.

### 6.6 Khóa thẻ (`POST /api/rfid-cards/:id/block`)
- Cập nhật `status = BLOCKED`.

### 6.7 Mở khóa thẻ (`POST /api/rfid-cards/:id/unblock`)
- Cập nhật `status = ACTIVE`.

---

## 7. PHÂN HỆ BIỂU PHÍ GỬI XE (`/api/pricing-rules`)

### 7.1 Danh sách biểu phí (`GET /api/pricing-rules`)
- **Query Params**: `parkingLotId=uuid`, `vehicleType=CAR|MOTORBIKE`, `isActive=true|false`

### 7.2 Chi tiết biểu phí (`GET /api/pricing-rules/:id`)

### 7.3 Tạo mới biểu phí (`POST /api/pricing-rules`)
- **Request Body**:
  ```json
  {
    "parkingLotId": "00000000-0000-0000-0000-000000000001",
    "vehicleType": "CAR",
    "pricingType": "PER_HOUR",
    "amount": 15000
  }
  ```
- **Ràng buộc**: `amount >= 0`, duy nhất theo bộ 3 `(parkingLotId, vehicleType, pricingType)`.

### 7.4 Cập nhật biểu phí (`PATCH /api/pricing-rules/:id`)
- **Request Body**: `{ "amount"?: number, "isActive"?: boolean }`

