# SMART PARKING IOT — PHASE 2 INDEPENDENT BACKEND AUDIT

**Dự án**: SMART PARKING IoT — CMS Management System  
**Phạm vi kiểm toán**: Phase 2 — Core Backend Services & Parking Slot Database Extension  
**Vai trò kiểm toán**: Senior Backend Architect, Independent QA Auditor, and API Security Reviewer  
**Ngày kiểm toán**: 2026-11-06  
**Kho lưu trữ**: `C:\Users\Vinh Nguyen\IOT`  
**Kết luận kiểm toán**: **PASS**

---

## 1. EXECUTIVE SUMMARY (TỔNG QUAN ĐIỀU HÀNH)

Đợt kiểm toán độc lập này tiến hành rà soát kỹ thuật toàn diện, khách quan và dựa trên bằng chứng thực thi thực tế (read-only verification) đối với toàn bộ mã nguồn, cấu hình, lược đồ cơ sở dữ liệu và các phân hệ dịch vụ Backend đã được xây dựng trong Pha 2.

### Tóm tắt kết quả kiểm toán:
1. **Lược đồ dữ liệu & Ràng buộc PostgreSQL**:
   - Thực thể `ParkingSlot` được tích hợp hoàn chỉnh với 2 enum định danh `SensorStatus` và `SlotOperationalStatus`.
   - Migration tuyến tính `20261106021903_parking_slot_extension` đã được áp dụng an toàn vào PostgreSQL 16 mà không gây xung đột hay phá hủy dữ liệu của Pha 0 và Pha 1.
   - Các ràng buộc cấp CSDL (`chk_parking_slot_sensor_mapping_pair`, `chk_parking_slot_sensor_channel_positive`, `unique_active_vehicle_session`, v.v.) được thực thi và kiểm chứng nghiêm ngặt.
2. **Bảo mật & Kiểm soát truy cập**:
   - Thư viện `helmet` đã được kích hoạt trên Express để bảo vệ HTTP Headers.
   - Xác thực JWT Bearer Token được áp dụng đồng bộ trên tất cả 6 router nghiệp vụ.
   - Phát hiện kiểm toán Pha 0 (`SEC-01`) liên quan đến Socket.IO đã được khắc phục triệt để: Mọi kết nối WebSocket đều phải xác thực JWT tại bước handshake, từ chối kết nối vô danh.
   - Mật khẩu quản trị viên được băm bằng bcryptjs (`SEED_ADMIN_PASSWORD`), không có mật khẩu bản rõ trong mã nguồn.
3. **Chất lượng dịch vụ & Tính toàn vẹn nghiệp vụ**:
   - Phân hệ `ParkingSlot` ngăn chặn CMS operator giả mạo trạng thái cảm biến vật lý.
   - Báo cáo độ lấp đầy (`occupancy`) xử lý chuẩn xác: Các slot `UNKNOWN` hoặc `MAINTENANCE` không bao giờ được tính là vị trí trống (`available`).
   - Phân hệ `RFID` hỗ trợ đầy đủ mô hình Cố định (Fixed) và Vãng lai (Visitor), bảo vệ không cho phép hủy/đổi xe khi thẻ đang trong phiên gửi xe chưa kết thúc.
   - Phân hệ `Vehicle` chuẩn hóa biển số xe tự động trên các thao tác tạo mới, cập nhật và tìm kiếm.
4. **Kiểm thử tự động**:
   - **59 / 59 bài kiểm thử đạt 100%** (12 test suites).
   - Kiểm tra chuẩn mã nguồn: TypeScript strict mode 0 lỗi, ESLint 0 lỗi và 0 cảnh báo.

---

## 2. ARCHITECTURE FINDINGS (ĐÁNH GIÁ KIẾN TRÚC MODULAR MONOLITH)

Hệ thống tuân thủ chặt chẽ kiến trúc Modular Monolith:
- **Tách biệt Controller & Service**:
  - Các Controller (`auth.controller.ts`, `parking-lot.controller.ts`, `parking-slot.controller.ts`, `vehicle.controller.ts`, `rfid.controller.ts`, `pricing.controller.ts`) hoàn toàn mỏng (thin controllers), chỉ đóng vai trò trích xuất tham số, gọi Service và chuẩn hóa phản hồi qua `sendSuccess` hoặc chuyển lỗi sang `next(error)`.
  - Toàn bộ quy tắc nghiệp vụ, kiểm tra ràng buộc logic và giao tiếp cơ sở dữ liệu đều được đóng gói tập trung trong các Service tương ứng.
- **Xử lý lỗi tập trung (Centralized Error Handling)**:
  - Tất cả các lỗi nghiệp vụ đều sử dụng `AppError` kèm `ErrorCode` có ngữ nghĩa cao và HTTP status code tương ứng (400, 401, 403, 404, 409, 500).
  - Không có hiện tượng rò rỉ stack trace ở môi trường production.
- **Fail-Fast Environment Validation**:
  - Toàn bộ biến môi trường được xác thực bởi Zod schema ngay khi khởi động (`src/config/env.ts`).

---

## 3. DATABASE FINDINGS (ĐÁNH GIÁ CƠ SỞ DỮ LIỆU)

### 3.1 Mô hình thực thể `ParkingSlot`
- Thực thể `ParkingSlot` liên kết với:
  - `ParkingLot` qua khóa ngoại `parkingLotId` với hành vi `onDelete: Restrict` (không cho phép xóa bãi xe nếu vẫn còn các ô đỗ).
  - `Device` qua khóa ngoại `sensorDeviceId` với hành vi `onDelete: SetNull` (nếu thiết bị cảm biến bị ngắt hoặc bảo trì, ô đỗ không bị xóa mà chỉ đưa về trạng thái chưa gán cảm biến).
- **Tính độc lập với `ParkingSession`**: Đúng theo yêu cầu thiết kế, `ParkingSlot` không liên kết trực tiếp với `ParkingSession`, giữ cho phiên gửi xe tập trung vào chu kỳ phương tiện qua barrier.

### 3.2 Ràng buộc PostgreSQL nâng cao
Đã kiểm chứng trực tiếp trên database `smart_parking_db`:
1. `chk_parking_slot_sensor_mapping_pair`:
   ```sql
   CHECK (("sensorDeviceId" IS NULL AND "sensorChannel" IS NULL) OR ("sensorDeviceId" IS NOT NULL AND "sensorChannel" IS NOT NULL))
   ```
   *Đánh giá*: Ngăn chặn hoàn toàn tình trạng gán thiết bị nhưng thiếu kênh, hoặc có kênh nhưng không rõ thiết bị. Đã được kiểm thử trong `tests/database-domain.test.ts` (Test 11).
2. `chk_parking_slot_sensor_channel_positive`:
   ```sql
   CHECK ("sensorChannel" IS NULL OR "sensorChannel" > 0)
   ```
   *Đánh giá*: Đảm bảo kênh cảm biến IO trên ESP32 phải là số nguyên dương $> 0$. Đã được kiểm chứng (Test 12).
3. `parking_slots_sensorDeviceId_sensorChannel_key`:
   - Chỉ mục duy nhất ngăn 2 slot khác nhau dùng chung một cổng cảm biến trên cùng 1 node phần cứng.
4. `parking_slots_parkingLotId_slotCode_key`:
   - Chỉ mục duy nhất đảm bảo mã slot không bị trùng lặp trong phạm vi cùng một bãi xe.

---

## 4. AUTHENTICATION & SECURITY AUDIT (ĐÁNH GIÁ BẢO MẬT & XÁC THỰC)

### 4.1 Quản lý mật khẩu & Đăng nhập
- Mật khẩu quản trị viên trong `seed.ts` được băm an toàn bằng `bcryptjs` với salt factor 10.
- `auth.service.ts` kiểm tra mật khẩu bằng `bcrypt.compare`.
- Phản hồi từ `POST /api/auth/login` và `GET /api/auth/me` tuyệt đối **không bao giờ trả về trường `passwordHash`**.

### 4.2 Xác thực JWT Bearer & Middleware
- Token được ký bằng `env.JWT_SECRET` với thời hạn cấu hình qua `env.JWT_EXPIRES_IN` (mặc định 24h).
- `jwtAuthMiddleware` xác minh token, truy vấn CSDL để đảm bảo người dùng tồn tại và `isActive === true`. Nếu tài khoản bị vô hiệu hóa, middleware trả về lỗi 403 `USER_INACTIVE`.
- Nếu token bị thiếu hoặc không đúng định dạng `Bearer <token>`, trả về lỗi 401 `UNAUTHORIZED`. Nếu token sai lệch hoặc hết hạn, trả về 401 `AUTH_TOKEN_INVALID` / `AUTH_TOKEN_EXPIRED`.

### 4.3 Khắc phục phát hiện SEC-01 trên Socket.IO
- Tại `backend/src/integrations/socket/socket.server.ts`, middleware `io.use()` đã được thiết lập. Mọi kết nối handshake bắt buộc phải cung cấp token JWT hợp lệ tại `socket.handshake.auth.token` hoặc header `Authorization`. Kết nối không hợp lệ bị từ chối ngay lập tức, ngăn ngừa việc rò rỉ bản tin sự kiện thời gian thực.

### 4.4 Bảo mật HTTP
- `helmet()` được tích hợp tại đầu chuỗi Express app, cung cấp đầy đủ các headers bảo vệ chống Clickjacking, MIME sniffing và XSS.

---

## 5. PARKING SLOT AUDIT (ĐÁNH GIÁ PHÂN HỆ VỊ TRÍ ĐỖ)

1. **Bảo toàn dữ liệu cảm biến**:
   - Schema Zod cập nhật slot (`updateParkingSlotSchema`) **không chứa trường `sensorStatus`**.
   - Do đó, CMS CRUD thông thường không thể can thiệp hay giả mạo kết quả đo cảm biến vật lý.
   - Trạng thái cảm biến chỉ có thể được cập nhật qua hàm nghiệp vụ nội bộ `updateSensorStatus()`, chuẩn bị cho module MQTT Event Ingestion ở Pha 3.
2. **Kiểm tra tính thuộc về của thiết bị**:
   - `parkingSlotService.validateSensorMapping` kiểm tra `device.parkingLotId === lotId`. Nếu gán thiết bị của bãi đỗ xe khác, yêu cầu sẽ bị từ chối với lỗi 400 `BAD_REQUEST`.
3. **Thuật toán tính toán sức chứa & Độ lấp đầy (`getOccupancy`)**:
   - Khi có các slots được cấu hình:
     - `available`: chỉ tăng khi `operationalStatus === 'AVAILABLE'` VÀ `sensorStatus === 'EMPTY'`.
     - `maintenance`: ghi nhận các slot có `operationalStatus === 'MAINTENANCE'`.
     - `unknown`: ghi nhận các slot có `sensorStatus === 'UNKNOWN'` (chưa xác định).
     - `occupied`: ghi nhận các slot có `operationalStatus === 'OCCUPIED'` hoặc `sensorStatus === 'OCCUPIED'`.
   - Các slot `UNKNOWN` và `MAINTENANCE` **tuyệt đối không được tính là chỗ trống**.

---

## 6. VEHICLE AUDIT (ĐÁNH GIÁ PHÂN HỆ PHƯƠNG TIỆN)

1. **Chuẩn hóa biển số xe (`normalizeLicensePlate`)**:
   - Thực hiện nhất quán trên cả 3 thao tác:
     - `POST /api/vehicles` (Tạo mới)
     - `PATCH /api/vehicles/:id` (Cập nhật)
     - `GET /api/vehicles?search=...` (Tìm kiếm)
   - Lược bỏ mọi ký tự gạch nối `-`, chấm `.`, khoảng trắng và chuyển thành chữ in hoa Hex/ASCII (ví dụ: `51A-123.45` -> `51A12345`).
2. **Phát hiện trùng lặp**:
   - So khớp biển số xe chuẩn hóa trên toàn bộ cơ sở dữ liệu. Nếu phát hiện biển số đã tồn tại, trả về lỗi 409 `VEHICLE_LICENSE_PLATE_EXISTS`.
3. **Phân loại phương tiện**:
   - Hỗ trợ chính xác 2 loại xe theo yêu cầu: `CAR` và `MOTORBIKE`.

---

## 7. RFID AUDIT (ĐÁNH GIÁ PHÂN HỆ THẺ TỪ)

1. **Hỗ trợ 2 mô hình vận hành**:
   - **Thẻ Cố định (Fixed RFID)**: Được liên kết với phương tiện qua `POST /api/rfid-cards/:id/assign`.
   - **Thẻ Vãng lai (Visitor RFID)**: Thẻ có `vehicleId === null`, có thể truy vấn lọc riêng qua query `isAssigned=false`.
2. **Quy tắc an toàn khi gán/hủy xe**:
   - Từ chối gán xe nếu thẻ đang ở trạng thái `BLOCKED` (`RFID_CARD_BLOCKED`).
   - Từ chối gán xe nếu phương tiện bị tạm khóa (`isActive === false`).
   - **Bảo toàn phiên gửi xe**: Nếu thẻ RFID đang nằm trong một phiên gửi xe chưa kết thúc (`ACTIVE`, `PENDING_ENTRY`, `PENDING_EXIT`), cả hai thao tác gán xe (`assign`) và hủy gán xe (`unassign`) đều bị từ chối với mã lỗi `RFID_ACTIVE_SESSION_EXISTS`.
3. **Khóa / Mở khóa thẻ**:
   - Hỗ trợ endpoint chuyên biệt `POST /api/rfid-cards/:id/block` và `POST /api/rfid-cards/:id/unblock` phục vụ xử lý khẩn cấp khi mất thẻ.

---

## 8. PRICING AUDIT (ĐÁNH GIÁ BIỂU PHÍ)

1. **Định dạng dữ liệu & Độ chính xác tài chính**:
   - Số tiền (`amount`) được lưu trữ dưới kiểu `Decimal(10, 2)` của PostgreSQL thông qua `Prisma.Decimal`, loại bỏ hoàn toàn sai số làm tròn số thực dấu phẩy động (floating point precision issues).
2. **Ràng buộc giá trị không âm**:
   - Kiểm tra hai lớp: Zod schema `amount >= 0` và PostgreSQL CHECK constraint `chk_pricing_rule_amount_non_negative`.
3. **Phòng chống trùng lặp**:
   - Khóa duy nhất `(parkingLotId, vehicleType, pricingType)` ngăn chặn việc cấu hình nhiều biểu phí xung đột cho cùng một loại xe trong cùng một bãi đỗ.

---

## 9. API SECURITY REVIEW (RÀ SOÁT BẢO MẬT API)

| Endpoint | Giao thức | Xác thực | Đánh giá an toàn |
| :--- | :---: | :---: | :--- |
| `GET /api/health` | HTTP GET | Public | An toàn (Không lộ thông tin nhạy cảm, chỉ báo trạng thái liveness) |
| `POST /api/auth/login` | HTTP POST | Public | An toàn (Rate limit cần thiết ở production, Zod validate đầu vào) |
| `GET /api/auth/me` | HTTP GET | Bearer JWT | An toàn (Không lộ password hash) |
| `GET /api/parking-lots` | HTTP GET | Bearer JWT | An toàn (Có phân trang) |
| `POST /api/parking-lots` | HTTP POST | Bearer JWT | An toàn (Zod validate, chỉ cho phép admin/operator) |
| `GET /api/parking-lots/:id/occupancy` | HTTP GET | Bearer JWT | An toàn (Tính toán thời gian thực chuẩn xác) |
| `GET /api/parking-lots/:lotId/slots` | HTTP GET | Bearer JWT | An toàn (Có lọc theo status) |
| `POST /api/parking-lots/:lotId/slots` | HTTP POST | Bearer JWT | An toàn (Ràng buộc cặp cảm biến & không cho impersonate status) |
| `GET /api/vehicles` | HTTP GET | Bearer JWT | An toàn (Chuẩn hóa tìm kiếm, phân trang) |
| `POST /api/vehicles` | HTTP POST | Bearer JWT | An toàn (Chống trùng lặp biển số chuẩn hóa) |
| `GET /api/rfid-cards` | HTTP GET | Bearer JWT | An toàn (Lọc được thẻ chưa gán) |
| `POST /api/rfid-cards/:id/assign` | HTTP POST | Bearer JWT | An toàn (Chặn đổi xe khi đang trong phiên đỗ) |
| `POST /api/rfid-cards/:id/block` | HTTP POST | Bearer JWT | An toàn (Khóa thẻ tức thời) |
| `GET /api/pricing-rules` | HTTP GET | Bearer JWT | An toàn |
| `POST /api/pricing-rules` | HTTP POST | Bearer JWT | An toàn (Chặn số âm & chặn cấu hình trùng lặp) |
| `WebSocket Handshake` | WSS / WS | Bearer JWT | An toàn (Khắc phục SEC-01, chặn kết nối vô danh) |

---

## 10. TEST EVIDENCE & CLASSIFICATION (BẰNG CHỨNG & PHÂN LOẠI KIỂM THỬ)

### 10.1 Phân loại 12 Test Suites (Tổng cộng 59 tests)
1. **Unit Tests (Kiểm thử đơn vị)**:
   - `tests/env.test.ts` (4 tests): Kiểm thử Zod schema biến môi trường, chuyển đổi port và chặn dữ liệu sai.
   - `tests/api-response.test.ts` (2 tests): Kiểm thử định dạng cấu trúc chuẩn `sendSuccess` và `sendError`.
2. **Mocked / Contract Tests**:
   - `tests/mqtt.test.ts` (4 tests): Kiểm thử cấu hình MQTT client, định dạng topic hierarchy và kiểm tra schema payload bản tin.
3. **Real Infrastructure Integration Tests (Kiểm thử tích hợp hạ tầng thực tế)**:
   - `tests/mqtt-integration.test.ts` (1 test): Kết nối thực tế tới Mosquitto Broker (`localhost:1883`) với tài khoản xác thực, publish và subscribe nhận gói tin QoS 1 thành công.
   - `tests/database-domain.test.ts` (12 tests): Kết nối trực tiếp tới PostgreSQL 16 container, kiểm chứng các ràng buộc toàn vẹn quan hệ, ràng buộc duy nhất, ràng buộc CHECK và Partial Unique Index.
4. **HTTP End-to-End Integration Tests (Kiểm thử tích hợp REST API qua Supertest)**:
   - `tests/health.test.ts` (2 tests): Liveness endpoint & 404 handler.
   - `tests/auth.test.ts` (5 tests): Đăng nhập, trích xuất profile, xử lý token sai và token thiếu.
   - `tests/parking-lot.test.ts` (5 tests): CRUD bãi đỗ xe và tính toán độ lấp đầy occupancy.
   - `tests/parking-slot.test.ts` (7 tests): CRUD ô đỗ, phát hiện trùng code, bắt vi phạm cặp cảm biến và xung đột kênh cảm biến.
   - `tests/vehicle.test.ts` (5 tests): CRUD phương tiện, chuẩn hóa biển số và chặn trùng lặp.
   - `tests/rfid.test.ts` (7 tests): CRUD thẻ RFID, chuẩn hóa mã Hex UID, gán/hủy xe, khóa và mở khóa thẻ.
   - `tests/pricing.test.ts` (5 tests): CRUD biểu phí, từ chối số âm và chống trùng quy tắc.

### 10.2 Kết quả thực thi lệnh kiểm tra độc lập
- `npx prisma validate`: **Exit Code 0** (The schema is valid 🚀)
- `npx prisma migrate status`: **Exit Code 0** (Database schema is up to date, 3 migrations found)
- `npm run typecheck`: **Exit Code 0** (Strict Mode, 0 errors)
- `npm run lint`: **Exit Code 0** (ESLint 0 errors, 0 warnings)
- `npm run test`: **Exit Code 0** (12 test files passed, 59 tests passed, 0 failed)
- `npm run build`: **Exit Code 0** (`tsc` biên dịch thành công)
- `docker compose ps`: **Exit Code 0** (Cả 2 dịch vụ Postgres và Mosquitto đều `Up (healthy)`)

---

## 11. AUDIT FINDINGS SUMMARY (BẢNG TỔNG KẾT PHÁT HIỆN)

| Mức độ nghiêm trọng | Số lượng | Mô tả chi tiết |
| :--- | :---: | :--- |
| **CRITICAL** | 0 | Không có |
| **HIGH** | 0 | Không có |
| **MEDIUM** | 0 | Không có |
| **LOW / INFORMATIONAL** | 1 | Cảnh báo deprecation của Prisma về thuộc tính `package.json#prisma` (sẽ được thay bằng `prisma.config.ts` ở Prisma 7, hiện tại hoạt động bình thường trên Prisma 6.19.3). |

---

## 12. PHASE 3 READINESS & VERDICT (KẾT LUẬN & ĐỘ SẴN SÀNG)

- **Độ sẵn sàng cho Pha 3**: **100% SẴN SÀNG**. Nền tảng dịch vụ cốt lõi, cơ sở dữ liệu ô đỗ, chuẩn hóa thẻ từ và cơ chế bảo mật đã được hoàn thiện vững chắc, tạo điều kiện thuận lợi để triển khai tiếp:
  - Vòng đời phiên gửi xe (`ParkingSession` check-in / check-out workflows).
  - MQTT Worker tiếp nhận và xử lý sự kiện quét thẻ RFID & cảm biến barrier.
  - Thuật toán tính toán biểu phí gửi xe lũy tiến.
- **KẾT LUẬN KIỂM TOÁN**: **PASS**.
