# DỰ THẢO HỢP ĐỒNG TRUYỀN THÔNG MQTT (MQTT CONTRACT DRAFT)

> [!IMPORTANT]
> **Tài liệu dự thảo (Draft Version 0.1.0)**: Hợp đồng này được thiết kế trong Pha 0 (Foundation) và phải được nhóm kỹ thuật phần cứng ESP32 thẩm duyệt trước khi hiện thực trực tiếp vào firmware.

---

## 1. NGUYÊN TẮC BẢO MẬT & THIẾT KẾ

1. **Xác thực bắt buộc (Authentication)**:
   - Eclipse Mosquitto Broker cấu hình `allow_anonymous false`. Mọi client (ESP32 và Backend) phải cung cấp Username và Password hợp lệ.
   - Không chứa thông tin xác thực dạng hardcoded trong mã nguồn mở.
2. **Kiểm soát truy cập (Access Control List - ACL)**:
   - Toàn bộ topic hoạt động trong không gian tên (namespace) `smartparking/#`.
   - Các thiết bị chỉ được phép gửi/nhận dữ liệu thuộc phạm vi mã thiết bị (`deviceId`) của mình.
3. **Quy tắc cấm cờ Retain đối với lệnh điều khiển (No Retained Executable Commands)**:
   - Các bản tin ra lệnh điều khiển mở barrier (`GATE_COMMAND` / `OPEN_GATE`) **tuyệt đối không được bật cờ `retain: true`**. Việc này ngăn ngừa rủi ro barrier tự động mở khi thiết bị biên khởi động lại và nhận phải lệnh cũ tồn đọng trên Broker.
4. **Mức dịch vụ đảm bảo (QoS)**:
   - Sự kiện quẹt thẻ và lệnh cổng: `QoS 1` (Đảm bảo đến nơi ít nhất một lần).
   - Nhịp tim định kỳ và cảm biến đỗ xe: `QoS 0` hoặc `QoS 1`.

---

## 2. CẤU TRÚC PHÂN CẤP TOPIC (TOPIC HIERARCHY)

| Hướng giao tiếp | Định dạng Topic | Mục đích |
|---|---|---|
| **ESP32 → Backend** | `smartparking/devices/{deviceId}/events` | Báo cáo sự kiện (quẹt thẻ, cảm biến, xe qua cổng) |
| **Backend → ESP32** | `smartparking/devices/{deviceId}/commands` | Gửi lệnh điều khiển phần cứng (mở/đóng barrier, đèn LED) |
| **ESP32 → Backend** | `smartparking/devices/{deviceId}/acks` | Xác nhận thực thi lệnh từ thiết bị biên |
| **ESP32 → Backend** | `smartparking/devices/{deviceId}/heartbeat` | Báo cáo nhịp tim định kỳ, thông số vận hành phần cứng |

---

## 3. ĐỊNH DẠNG BẢN TIN CHUẨN (STANDARD PAYLOAD STRUCTURE)

Mọi bản tin đều sử dụng định dạng chuỗi JSON có cấu trúc gốc:

```json
{
  "type": "MESSAGE_TYPE",
  "deviceId": "gate_esp32_entry_01",
  "timestamp": 1730815200000,
  "payload": {}
}
```

---

## 4. CÁC LOẠI BẢN TIN ĐỀ XUẤT (PROPOSED MESSAGE TYPES)

### 4.1. `RFID_SCANNED` (ESP32 → Backend)
Phát ra khi đầu đọc RC522 quét thấy thẻ từ tại cổng vào hoặc cổng ra.

- **Topic**: `smartparking/devices/{deviceId}/events`
- **Ví dụ Payload**:
```json
{
  "type": "RFID_SCANNED",
  "deviceId": "gate_entry_01",
  "timestamp": 1730815200120,
  "payload": {
    "cardUid": "A1B2C3D4",
    "gateType": "ENTRY",
    "readerId": "RC522_PORT_1"
  }
}
```

### 4.2. `GATE_COMMAND` (Backend → ESP32)
Lệnh điều khiển barrier từ Backend sau khi kiểm tra tính hợp lệ của thẻ hoặc thao tác cưỡng bức của quản trị viên.

- **Topic**: `smartparking/devices/{deviceId}/commands`
- **Quy tắc an ninh**: `retain: false`
- **Ví dụ Payload**:
```json
{
  "type": "GATE_COMMAND",
  "deviceId": "gate_entry_01",
  "timestamp": 1730815200500,
  "payload": {
    "commandId": "cmd_9f8e7d6c",
    "action": "OPEN_GATE",
    "gateId": "GATE_01",
    "timeoutMs": 7000
  }
}
```

### 4.3. `COMMAND_ACK` (ESP32 → Backend)
Xác nhận thiết bị đã nhận và thực thi xong lệnh điều khiển.

- **Topic**: `smartparking/devices/{deviceId}/acks`
- **Ví dụ Payload**:
```json
{
  "type": "COMMAND_ACK",
  "deviceId": "gate_entry_01",
  "timestamp": 1730815200850,
  "payload": {
    "commandId": "cmd_9f8e7d6c",
    "success": true,
    "executedAt": 1730815200800,
    "errorMessage": null
  }
}
```

### 4.4. `VEHICLE_PASSED` (ESP32 → Backend)
Cảm biến quang sau barrier xác nhận phương tiện đã đi qua an toàn, barrier có thể hạ xuống.

- **Topic**: `smartparking/devices/{deviceId}/events`
- **Ví dụ Payload**:
```json
{
  "type": "VEHICLE_PASSED",
  "deviceId": "gate_entry_01",
  "timestamp": 1730815204200,
  "payload": {
    "gateId": "GATE_01",
    "direction": "IN"
  }
}
```

### 4.5. `SENSOR_CHANGED` (ESP32 → Backend)
Cảm biến siêu âm tại vị trí đỗ báo cáo sự thay đổi trạng thái có xe hoặc trống.

- **Topic**: `smartparking/devices/{deviceId}/events`
- **Ví dụ Payload**:
```json
{
  "type": "SENSOR_CHANGED",
  "deviceId": "sensor_node_zone_a",
  "timestamp": 1730815210000,
  "payload": {
    "slotId": "SLOT_A_12",
    "isOccupied": true,
    "distanceCm": 45
  }
}
```

### 4.6. `DEVICE_HEARTBEAT` (ESP32 → Backend)
Báo cáo định kỳ (mỗi 30s hoặc 60s) để giám sát tình trạng sống của thiết bị.

- **Topic**: `smartparking/devices/{deviceId}/heartbeat`
- **Ví dụ Payload**:
```json
{
  "type": "DEVICE_HEARTBEAT",
  "deviceId": "gate_entry_01",
  "timestamp": 1730815230000,
  "payload": {
    "firmwareVersion": "0.1.0-esp32",
    "uptimeSeconds": 3600,
    "freeHeap": 174200,
    "wifiRssi": -58
  }
}
```

