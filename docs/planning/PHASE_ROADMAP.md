# KẾ HOẠCH TRIỂN KHAI DỰ ÁN 2–3 TUẦN (PROJECT ROADMAP)

Dự án đồ án tốt nghiệp / môn học IoT: **SMART PARKING IoT — CMS Management System**.  
Thời lượng còn lại: Khoảng 2–3 tuần (~21 ngày).

---

## PHA 0: XÂY DỰNG NỀN TẢNG HỆ THỐNG (FOUNDATION) — [HOÀN TẤT]
- Khởi tạo cấu trúc dự án Modular Monolith (`backend/`, `frontend/`, `firmware/`, `docs/`, `docker/`).
- Triển khai Docker Compose cho PostgreSQL 16 và Eclipse Mosquitto Broker.
- Cấu hình Backend Express + TypeScript strict mode, Zod, centralized error handling, request logging, graceful shutdown.
- Thiết lập Prisma ORM, kiểm tra migration ban đầu và xác thực kết nối Database.
- Hiện thực lớp tích hợp MQTT.js (resilience, reconnection, validation, ACL dev, bảo mật cấm cờ retain với lệnh điều khiển).
- Khởi tạo Socket.IO kết nối realtime với CMS.
- Xây dựng React CMS Shell: sidebar điều hướng 8 phân hệ, navbar, widget kiểm tra sức khỏe backend realtime qua `/api/health`.
- Kiểm thử tự động (Unit tests, typecheck, lint, build) vượt qua 100%.

---

## PHA 1: THIẾT KẾ DOMAIN & ĐỒNG BỘ PHẦN CỨNG ESP32 (NGÀY 1 – NGÀY 5)
- **Mục tiêu**: Hoàn thiện thực thể dữ liệu và chốt hợp đồng MQTT với nhóm làm phần cứng.
- **Nội dung công việc**:
  1. Thống nhất và chốt văn bản `docs/mqtt/MQTT_CONTRACT_DRAFT.md` với nhóm làm mạch ESP32.
  2. Bổ sung các bảng nghiệp vụ vào `prisma/schema.prisma`:
     - `User`, `Vehicle`, `RFIDCard`
     - `ParkingLot`, `ParkingSlot`
     - `Device`, `DeviceEvent`
     - `ParkingSession`, `PricingRule`
  3. Chạy Prisma migration và tạo script nạp dữ liệu mẫu phát triển (`prisma/seed.ts`).
  4. Đăng ký nhận sự kiện quét thẻ `RFID_SCANNED` và sự kiện cảm biến vị trí đỗ `SENSOR_CHANGED` từ MQTT vào cơ sở dữ liệu.

---

## PHA 2: NGHIỆP VỤ CHECK-IN/CHECK-OUT & ĐIỀU KHIỂN CỔNG (NGÀY 6 – NGÀY 12)
- **Mục tiêu**: Xử lý logic tự động nâng hạ barrier khi quẹt thẻ và quản lý phiên đỗ.
- **Nội dung công việc**:
  1. Logic xe vào (Check-in flow):
     - Quẹt thẻ RFID → Xác thực thẻ tồn tại → Kiểm tra bãi còn chỗ trống → Tạo `ParkingSession` (ACTIVE) → Gửi lệnh `GATE_COMMAND (OPEN_GATE)` tới ESP32.
  2. Logic xe ra (Check-out & Billing flow):
     - Quẹt thẻ tại cổng ra → Tìm phiên đỗ tương ứng → Tính toán thời gian đỗ xe → Áp dụng biểu giá `PricingRule` → Thu phí → Mở cổng.
  3. Cảm biến chống kẹt và xác nhận xe qua cổng:
     - Nhận sự kiện `VEHICLE_PASSED` → Đóng barrier tự động.

---

## PHA 3: HOÀN THIỆN CMS ĐIỀU HÀNH & BÁO CÁO (NGÀY 13 – NGÀY 17)
- **Mục tiêu**: Cung cấp giao diện trực quan cho quản trị viên và nhân viên kiểm soát.
- **Nội dung công việc**:
  1. Màn hình sơ đồ bãi xe trực quan (Slot Grid): Cập nhật màu xanh (trống) / đỏ (có xe) theo thời gian thực qua Socket.IO.
  2. Quản lý thẻ RFID: Cấp mới, đổi mã, vô hiệu hóa thẻ mất.
  3. Danh sách phiên xe đang đỗ và lịch sử ra vào.
  4. Báo cáo doanh thu và xuất file CSV thống kê ca trực.

---

## PHA 4: KIỂM THỬ TÍCH HỢP TOÀN DIỆN & BẢO VỆ ĐỒ ÁN (NGÀY 18 – NGÀY 21)
- **Mục tiêu**: Ổn định hệ thống và chuẩn bị kịch bản demo bảo vệ.
- **Nội dung công việc**:
  1. Kiểm thử kịch bản rớt mạng Wi-Fi của ESP32 và khôi phục tự động qua Mosquitto.
  2. Kiểm thử tải đồng thời nhiều lượt quẹt thẻ liên tiếp.
  3. Chuẩn bị slide trình chiếu, video demo mô hình thực tế và tài liệu báo cáo tổng kết.

