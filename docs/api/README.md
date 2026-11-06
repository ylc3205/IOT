# SMART PARKING IOT — REST API SPECIFICATION (PHASE 0)

---

## 1. QUY CHUẨN ĐỊNH DẠNG PHẢN HỒI (API CONVENTIONS)

Tất cả các API của hệ thống đều phản hồi dưới định dạng JSON thống nhất:

### Phản hồi thành công (HTTP 2xx)
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "smart-parking-api"
  }
}
```

### Phản hồi lỗi (HTTP 4xx / 5xx)
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Mô tả chi tiết nguyên nhân lỗi",
    "details": {} // (Tùy chọn: chi tiết validation hoặc metadata)
  }
}
```

---

## 2. DANH MỤC MÃ LỖI CHUẨN (STANDARD ERROR CODES)

| Mã lỗi | HTTP Status | Diễn giải |
|---|---|---|
| `INTERNAL_SERVER_ERROR` | 500 | Lỗi hệ thống nội bộ không xử lý được |
| `NOT_FOUND` | 404 | Tài nguyên hoặc route yêu cầu không tồn tại |
| `BAD_REQUEST` | 400 | Yêu cầu không đúng định dạng cú pháp JSON |
| `VALIDATION_ERROR` | 400 | Dữ liệu đầu vào vi phạm schema Zod |
| `UNAUTHORIZED` | 401 | Thiếu hoặc token xác thực không hợp lệ (pha sau) |
| `FORBIDDEN` | 403 | Không đủ quyền hạn thao tác (pha sau) |
| `DATABASE_CONNECTION_ERROR`| 503 | Mất kết nối tới PostgreSQL |
| `MQTT_CONNECTION_ERROR` | 503 | Mất kết nối tới Mosquitto Broker |

---

## 3. CÁC ENDPOINT HIỆN HÀNH (PHASE 0 ENDPOINTS)

### 3.1. Liveness Check
Kiểm tra máy chủ Node.js có phản hồi HTTP bình thường hay không (độc lập với Database và MQTT).

- **Method**: `GET`
- **Route**: `/api/health`
- **Response**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "smart-parking-api"
  }
}
```

### 3.2. Readiness Diagnostic Check
Kiểm tra khả năng phục vụ toàn diện, bao gồm kết nối cơ sở dữ liệu PostgreSQL và Broker MQTT Mosquitto.

- **Method**: `GET`
- **Route**: `/api/health/ready`
- **Response (Sẵn sàng - HTTP 200)**:
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "database": "connected",
    "mqtt": "connected",
    "timestamp": "2026-11-05T14:09:58.725Z"
  }
}
```
- **Response (Xuống cấp - HTTP 503)**:
```json
{
  "success": true,
  "data": {
    "status": "degraded",
    "database": "disconnected",
    "mqtt": "connected",
    "timestamp": "2026-11-05T14:10:00.000Z"
  }
}
```

