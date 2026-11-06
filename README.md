# SMART PARKING IOT — CMS MANAGEMENT SYSTEM

Hệ thống quản lý bãi đỗ xe thông minh ứng dụng vi điều khiển ESP32, chuẩn truyền thông thời gian thực MQTT (Eclipse Mosquitto Broker), máy chủ dịch vụ Express TypeScript (Modular Monolith), cơ sở dữ liệu quan hệ PostgreSQL (Prisma ORM) và giao diện điều hành React CMS.

---

## 1. GIỚI THIỆU DỰ ÁN (PROJECT INTRODUCTION)

Dự án **Smart Parking IoT** được xây dựng nhằm giải quyết bài toán tự động hóa kiểm soát phương tiện ra vào bãi xe và giám sát không gian đỗ theo thời gian thực. Hệ thống kết hợp chặt chẽ giữa thiết bị phần cứng biên (Edge IoT), tầng truyền thông phân tán (MQTT), dịch vụ máy chủ trung tâm (Backend API & WebSocket) và cổng thông tin điều hành (CMS Web) dành cho ban quản lý và nhân viên trực barrier.

---

## 2. MỤC TIÊU HỆ THỐNG (SYSTEM OBJECTIVES)

- **Tự động hóa cổng kiểm soát**: Sử dụng thẻ từ RFID (Mifare RC522 13.56 MHz) và cảm biến hồng ngoại để điều khiển barrier an toàn, ngăn chặn đóng hạ cần khi có phương tiện bên dưới.
- **Giám sát độ lấp đầy thời gian thực**: Cập nhật trạng thái từng vị trí đỗ xe (`ParkingSlot`) qua các node cảm biến, cung cấp số liệu trực quan cho CMS.
- **Toàn vẹn và an toàn dữ liệu**: Ngăn chặn gian lận quẹt thẻ, chống trùng lặp sự kiện MQTT (Idempotency) và bảo vệ nghiêm ngặt ở cấp độ ràng buộc cơ sở dữ liệu PostgreSQL.
- **Kiến trúc Modular Monolith thực dụng**: Tập trung hoàn thiện trong chu kỳ phát triển 2–3 tuần, sẵn sàng mở rộng REST API phục vụ ứng dụng người dùng (Mobile) trong tương lai.

---

## 3. CÔNG NGHỆ SỬ DỤNG (TECHNOLOGY STACK)

### Backend & Cơ sở dữ liệu:
- **Ngôn ngữ & Nền tảng**: Node.js LTS (v20+ / v22+), TypeScript (Strict Mode).
- **Framework Web**: Express.js (Modular Monolith Architecture).
- **Cơ sở dữ liệu & ORM**: PostgreSQL 16 Alpine, Prisma ORM v6.
- **Truyền thông & Sự kiện**: MQTT.js (MQTT v5/v3.1.1), Socket.IO v4.
- **Bảo mật & Xác thực**: JSON Web Tokens (jsonwebtoken), bcryptjs, Helmet security headers, Zod validation schema.
- **Kiểm thử tự động**: Vitest, Supertest.

### Frontend Web CMS:
- **Nền tảng**: React 18, Vite, TypeScript.
- **Routing & State**: React Router v6, TanStack Query v5 (React Query).
- **Giao diện & Thành phần**: Tailwind CSS, shadcn/ui primitives, Lucide React Icons.
- **Biểu mẫu & Xác thực**: React Hook Form, @hookform/resolvers/zod.

### Hạ tầng & Phần cứng:
- **Container**: Docker, Docker Compose.
- **MQTT Message Broker**: Eclipse Mosquitto 2.x (Password authentication & Scoped ACL).
- **Phần cứng mục tiêu**: NodeMCU ESP32-WROOM-32, Đầu đọc RFID RC522, Động cơ Servo / Relay, Cảm biến tiệm cận quang hồng ngoại IR, Cảm biến siêu âm HC-SR04.

---

## 4. KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)

Hệ thống được tổ chức theo mô hình phân tầng chặt chẽ:

```
[ Thiết bị biên ESP32 ]          [ Trình duyệt React CMS ]
   ├── Gate Node (RFID + Servo)              │
   └── Sensor Node (Ô đỗ xe)                 │
          │                                  │ (HTTP REST / WebSocket)
     (MQTT QoS 1)                            ▼
          ▼                        ┌──────────────────────────────┐
┌──────────────────┐               │     Express Backend API      │
│ Eclipse Mosquitto│ <───────────> │  (Auth, Lots, Slots, RFID,  │
│   MQTT Broker    │  MQTT Client  │   Vehicles, Pricing, Health) │
└──────────────────┘               └──────────────┬───────────────┘
                                                  │ (Prisma Client)
                                                  ▼
                                   ┌──────────────────────────────┐
                                   │    PostgreSQL 16 Database    │
                                   │ (Enums, Constraints, Tables) │
                                   └──────────────────────────────┘
```

---

## 5. CÁC TÍNH NĂNG CHÍNH ĐÃ TRIỂN KHAI (MAIN FEATURES)

1. **Quản lý bãi đỗ xe (`/api/parking-lots`)**:
   - Thêm, sửa, xem danh sách và chi tiết thông số bãi đỗ xe.
   - Báo cáo độ lấp đầy (`/occupancy`): Tự động tính toán số chỗ trống (`available`), chỗ đang đỗ (`occupied`), vị trí bảo trì (`maintenance`) và vị trí chưa xác định (`unknown`).
2. **Quản lý vị trí đỗ xe & Cảm biến (`/api/parking-slots`)**:
   - Cấu hình từng ô đỗ xe riêng biệt (`slotCode`).
   - Liên kết ánh xạ với thiết bị cảm biến phần cứng (`sensorDeviceId`) và kênh chân IO (`sensorChannel`).
   - Ràng buộc chặt chẽ: Không cho phép cấu hình 2 slot trùng kênh trên cùng 1 node cảm biến; thiết bị cảm biến phải thuộc cùng bãi xe.
3. **Quản lý phương tiện (`/api/vehicles`)**:
   - Đăng ký và quản lý phương tiện (`CAR`, `MOTORBIKE`).
   - Tự động chuẩn hóa biển số xe (`normalizeLicensePlate`) khi tạo mới, cập nhật và tìm kiếm (loại bỏ ký tự đặc biệt, viết hoa toàn bộ).
4. **Quản lý thẻ từ RFID (`/api/rfid-cards`)**:
   - Quản lý mã UID phần cứng chuẩn hóa dạng Hex viết hoa.
   - Hỗ trợ mô hình thẻ Cố định (gán xe) và thẻ Vãng lai (chưa gán xe).
   - Bảo toàn an toàn giao dịch: Từ chối đổi xe hoặc hủy gán khi thẻ đang trong phiên đỗ dở dang.
   - Hỗ trợ khóa khẩn cấp (`/block`) và mở khóa thẻ (`/unblock`).
5. **Cấu hình biểu phí (`/api/pricing-rules`)**:
   - Thiết lập giá tiền theo lượt (`PER_VISIT`) hoặc theo giờ (`PER_HOUR`) cho từng loại phương tiện (`CAR`, `MOTORBIKE`).
   - Ràng buộc tài chính: Mức phí được lưu bằng kiểu `Decimal(10,2)` và bắt buộc $\ge 0$.
6. **Xác thực & An ninh hệ thống (`/api/auth`)**:
   - Đăng nhập tài khoản CMS qua JWT Bearer Token; mật khẩu băm chuẩn bcrypt.
   - Toàn bộ kết nối thời gian thực WebSocket Socket.IO bắt buộc xác thực token tại handshake.

---

## 6. HIỆN TRẠNG TRIỂN KHAI (CURRENT IMPLEMENTATION STATUS)

### ✅ ĐÃ HOÀN THÀNH:
- **Phase 0 — Foundation & Infrastructure**:
  - Bootstrap kiến trúc Express TypeScript và React CMS Web.
  - Thiết lập hạ tầng Docker Compose (PostgreSQL 16 & Eclipse Mosquitto với xác thực).
  - Kết nối MQTT Client và Socket.IO Server.
- **Phase 1 — Database Domain Modeling**:
  - Thiết kế toàn bộ mô hình CSDL quan hệ: `User`, `ParkingLot`, `Vehicle`, `RFIDCard`, `ParkingSession`, `Device`, `DeviceEvent`, `PricingRule`.
  - Thiết lập migration và các ràng buộc PostgreSQL nâng cao: Không âm (`totalFee >= 0`, `amount >= 0`), Idempotency sự kiện MQTT `(deviceId, eventId)`, chỉ mục điều kiện chống gửi xe 2 lần (`unique_active_vehicle_session`).
- **Phase 2 — Core Backend Services & Parking Slot Database Extension**:
  - Mở rộng thực thể `ParkingSlot` kèm enums `SensorStatus` và `SlotOperationalStatus`.
  - Migration `20261106021903_parking_slot_extension` với các ràng buộc đồng bộ cặp cảm biến và kênh cảm biến dương.
  - Hiện thực hóa 6 phân hệ REST API: Auth, ParkingLot, ParkingSlot, Vehicle, RFID, Pricing.
  - Gia cố an ninh: Helmet headers, xác thực JWT handshake Socket.IO.
  - Bộ kiểm thử tự động 59/59 tests đạt 100%.

### ⏳ CHƯA TRIỂN KHAI (DỰ KIẾN TRONG CÁC PHA TIẾP THEO):
- Vòng đời phiên gửi xe tự động (`ParkingSession` check-in/check-out workflows).
- MQTT Worker phân tích cú pháp bản tin quét thẻ từ ESP32 và kích hoạt mở barrier.
- Thuật toán tính toán phí gửi xe tự động khi xe ra khỏi bãi.
- Giao diện điều hành nghiệp vụ trực tiếp trên React CMS (kết nối REST API vào bảng dữ liệu thật).
- Ứng dụng di động (Mobile App) cho người dùng cuối.

---

## 7. CẤU TRÚC THƯ MỤC REPOSITORY (REPOSITORY STRUCTURE)

```text
IOT/
├── .github/
│   └── workflows/
│       └── ci.yml            # CI Workflow kiểm tra typecheck, lint, build
├── backend/                  # Mã nguồn Express TypeScript Backend API
│   ├── prisma/
│   │   ├── migrations/       # Lịch sử các bước di chuyển PostgreSQL
│   │   ├── schema.prisma     # Định nghĩa lược đồ dữ liệu Prisma
│   │   └── seed.ts           # Script nạp dữ liệu mẫu phát triển
│   ├── src/
│   │   ├── common/           # Middleware, Error classes, Utils (JWT, Normalizers)
│   │   ├── config/           # Cấu hình biến môi trường và Zod validation
│   │   ├── integrations/     # Kết nối Database, MQTT Client, Socket.IO Server
│   │   ├── modules/          # Phân hệ nghiệp vụ (auth, parking-lots, slots, vehicles...)
│   │   ├── app.ts            # Khởi tạo Express app & gắn middlewares
│   │   └── server.ts         # Khởi chạy HTTP Server & Graceful shutdown
│   ├── tests/                # Bộ kiểm thử tự động Vitest + Supertest
│   └── package.json
│
├── frontend/                 # Mã nguồn React CMS Web (Vite + Tailwind)
│   ├── src/
│   │   ├── app/              # Cấu hình Router và Root component
│   │   ├── components/       # UI Primitives, Layouts, Widgets
│   │   ├── features/         # Các trang quản trị CMS
│   │   └── services/         # Axios API client
│   ├── tests/                # Route smoke tests
│   └── package.json
│
├── docker/
│   └── mosquitto/
│       └── config/           # File cấu hình Mosquitto Broker, mật khẩu dev & ACL
│
├── docs/                     # Tài liệu kỹ thuật chi tiết
│   ├── api/                  # Hợp đồng giao tiếp REST API (Phase 2 API Contract)
│   ├── architecture/         # Kiến trúc Modular Monolith & An ninh
│   ├── audits/               # Báo cáo kiểm định độc lập các Pha (0, 1, 2)
│   ├── database/             # Chi tiết mở rộng ParkingSlot & mô hình miền
│   └── mqtt/                 # Dự thảo hợp đồng bản tin MQTT cho ESP32
│
├── firmware/                 # Tài liệu bảo lưu cho sơ đồ mạch & firmware ESP32
├── docker-compose.yml        # Docker Compose cấu hình PostgreSQL & Mosquitto
├── .env.example              # Mẫu biến môi trường an toàn (không chứa secret thật)
├── .gitignore                # Danh mục các file loại trừ khỏi Git
├── AGENTS.md                 # Quy chuẩn phát triển dành cho AI Agents
└── README.md                 # Hướng dẫn kỹ thuật tổng quan dự án
```

---

## 8. HƯỚNG DẪN CÀI ĐẶT & CHẠY DỰ ÁN CỤC BỘ (LOCAL SETUP)

### Yêu cầu tiên quyết:
- **Node.js**: Phiên bản LTS (khuyến nghị v20.x hoặc v22.x).
- **Docker Desktop**: Đang chạy trên máy tính phát triển.
- **Git**: Đã cài đặt trên hệ điều hành.

### Bước 1: Sao chép biến môi trường
```bash
cp .env.example .env
cp .env backend/.env
```

### Bước 2: Khởi động cơ sở hạ tầng Docker
```bash
docker compose up -d
```
Kiểm tra trạng thái container:
```bash
docker compose ps
```
> Yêu cầu: Cả `smart-parking-postgres` và `smart-parking-mosquitto` đều ở trạng thái `Up (healthy)`.

### Bước 3: Cài đặt và Di chuyển Cơ sở dữ liệu (Backend)
```bash
cd backend
npm install
npx prisma migrate dev
npm run prisma:seed
```

### Bước 4: Khởi chạy máy chủ phát triển Backend
```bash
npm run dev
```
- Máy chủ API lắng nghe tại: `http://localhost:5000`
- Kiểm tra trạng thái hoạt động: `http://localhost:5000/api/health`

### Bước 5: Cài đặt và Khởi chạy Frontend CMS
Mở một cửa sổ dòng lệnh mới:
```bash
cd frontend
npm install
npm run dev
```
- Truy cập giao diện CMS tại: `http://localhost:5173`

---

## 9. LỆNH KIỂM THỬ VÀ KIỂM TRA MÃ NGUỒN (TEST & VERIFICATION)

### Kiểm tra Backend:
```bash
cd backend
npm run typecheck    # Kiểm tra kiểu TypeScript Strict Mode (0 lỗi)
npm run lint         # Kiểm tra chuẩn mã nguồn ESLint 9 (0 lỗi, 0 cảnh báo)
npm run test         # Chạy toàn bộ 59 bài kiểm thử Vitest
npm run build        # Biên dịch production sang thư mục dist/
```

### Kiểm tra Frontend:
```bash
cd frontend
npm run typecheck    # Kiểm tra kiểu React TypeScript
npm run lint         # Kiểm tra ESLint
npm run test         # Chạy smoke test giao diện
npm run build        # Biên dịch production bằng Vite
```

---

## 10. KIẾN TRÚC TRUYỀN THÔNG MQTT (MQTT TOPIC HIERARCHY)

Hệ thống giao tiếp hai chiều giữa ESP32 và máy chủ thông qua các chủ đề (topics) có phân cấp:

- **Sự kiện từ thiết bị gửi lên (Device Events)**:
  - `smartparking/devices/{deviceId}/events` (QoS 1)
  - Ví dụ: Thẻ RFID được quẹt tại cổng (`RFID_SCANNED`), cảm biến hồng ngoại kích hoạt xe qua (`IR_TRIGGERED`), cảm biến ô đỗ thay đổi (`SLOT_CHANGED`).
- **Lệnh điều khiển từ máy chủ gửi xuống (Gate Commands)**:
  - `smartparking/devices/{deviceId}/commands` (QoS 1, **Tuyệt đối cấm cờ `retain: true`** để đảm bảo an toàn phần cứng barrier).
  - Lệnh mở cổng: `{"command": "OPEN_GATE", "reason": "ENTRY_APPROVED"}`.
  - Lệnh đóng cổng: `{"command": "CLOSE_GATE"}`.
- **Trạng thái kết nối & Nhịp tim (Heartbeat & LWT)**:
  - `smartparking/devices/{deviceId}/status`: Bản tin Last Will and Testament ghi nhận `OFFLINE` khi mất điện hoặc mất Wi-Fi đột ngột.

---

## 11. TÀI KHOẢN VẬN HÀNH MẪU (DEFAULT SEED CREDENTIALS)

Khi chạy lệnh `npm run prisma:seed`, hệ thống tự động khởi tạo dữ liệu ban đầu phục vụ phát triển:

- **Tài khoản CMS**: `operator@smartparking.local`
- **Mật khẩu mặc định**: `Admin@123456` (Cấu hình qua biến môi trường `SEED_ADMIN_PASSWORD`).
- **Bãi đỗ xe mẫu**: `Bãi Đỗ Xe Đại Học - Khu A` (Sức chứa: 100 xe).
- **Vị trí đỗ mẫu**: `A-01`, `A-02` (Trống), `A-03` (Bảo trì), `B-01` (Gán cảm biến `SENSOR_NODE_01` kênh 1).
- **Thẻ từ mẫu**: `E20000190600` (Gán cho ô tô `51A-12345`), `E20000190601` (Gán cho xe máy `59B1-98765`).

---

## 12. LỘ TRÌNH PHÁT TRIỂN TIẾP THEO (ROADMAP)

- [x] **Pha 0**: Khởi tạo hạ tầng, Docker Compose, Express Bootstrap, Socket.IO, MQTT Client.
- [x] **Pha 1**: Thiết kế mô hình miền CSDL PostgreSQL & Ràng buộc toàn vẹn nâng cao.
- [x] **Pha 2**: Mở rộng ô đỗ xe `ParkingSlot`, Dịch vụ Backend cốt lõi, Xác thực & Phân hệ quản lý.
- [ ] **Pha 3**: Luồng nghiệp vụ phiên gửi xe (Check-in/Check-out), MQTT Event Ingestion Worker, Tính phí tự động.
- [ ] **Pha 4**: Tích hợp giao diện điều hành thời gian thực React CMS với WebSocket và REST API.
- [ ] **Pha 5**: Tích hợp thực tế phần cứng ESP32 và bàn giao nghiệm thu đồ án.
