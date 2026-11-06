# Firmware & Hardware Assets Placeholder

Thư mục này được bảo lưu dành cho mã nguồn firmware ESP32 và sơ đồ nguyên lý phần cứng của dự án **Smart Parking IoT**.

## Cấu trúc phần cứng dự kiến:
1. **Gate Node (Cổng vào / Cổng ra)**:
   - Vi điều khiển: ESP-WROOM-32
   - Đầu đọc thẻ: RC522 RFID Reader (13.56 MHz, giao tiếp SPI)
   - Điều khiển Barrier: Động cơ servo / Relay kích hoạt cần chắn
   - Cảm biến phát hiện xe: Cảm biến quang hồng ngoại / Cảm biến tiệm cận
   - Báo hiệu: Đèn LED trạng thái (Xanh / Đỏ), Còi buzzer

2. **Sensor Node (Vị trí đỗ xe)**:
   - Cảm biến siêu âm HC-SR04 / Cảm biến laser ToF đo khoảng cách phát hiện xe chiếm chỗ
   - LED hiển thị trạng thái tại từng vị trí đỗ

## Ghi chú tích hợp phần cứng:
- Toàn bộ giao tiếp giữa ESP32 và hệ thống Backend tuân thủ dự thảo hợp đồng tại [`docs/mqtt/MQTT_CONTRACT_DRAFT.md`](../docs/mqtt/MQTT_CONTRACT_DRAFT.md).
- Không tự ý sửa đổi firmware hoặc logic chấp nhận thẻ cứng cho đến khi hoàn tất kiểm thử hợp đồng dữ liệu.

