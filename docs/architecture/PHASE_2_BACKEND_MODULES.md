# SMART PARKING IOT — PHASE 2 BACKEND ARCHITECTURE & CORE SERVICES

## 1. TỔNG QUAN KIẾN TRÚC MODULAR MONOLITH

Hệ thống Backend của Smart Parking IoT được tổ chức theo mô hình **Modular Monolith** nhằm bảo đảm tính đơn giản, thực dụng, dễ bảo trì và mở rộng trong thời gian phát triển giới hạn 2–3 tuần của dự án:

```
backend/src/
├── app.ts                          # Bootstrap Express & Middleware cấu hình
├── server.ts                       # Startup HTTP Server, MQTT Client & Socket.IO
├── config/
│   └── env.ts                      # Fail-Fast Environment Validation (Zod)
├── common/
│   ├── errors/                     # AppError & Danh mục mã lỗi có ngữ nghĩa
│   ├── middleware/                 # Auth, Validation, Logger, Not-Found, Error Handlers
│   └── utils/                      # ApiResponse, Logger, JWT, Normalizers, Pagination
├── integrations/
│   ├── database/                   # Prisma Client
│   ├── mqtt/                       # MQTT.js Client & Connection Manager
│   └── socket/                     # Socket.IO Real-time Server (Hardened)
└── modules/
    ├── health/                     # Liveness / Readiness API
    ├── auth/                       # Authentication (JWT, bcrypt)
    ├── parking-lots/               # Quản lý bãi đỗ xe & Occupancy
    ├── parking-slots/              # Quản lý ô đỗ xe & sensor mapping
    ├── vehicles/                   # Quản lý phương tiện
    ├── rfid-cards/                 # Quản lý thẻ từ & gán xe
    └── pricing/                    # Biểu phí gửi xe
```

---

## 2. NGUYÊN TẮC THIẾT KẾ & BẢO MẬT (SECURITY & DESIGN PRINCIPLES)

### 2.1 Chuẩn hóa phản hồi & Bắt lỗi tập trung
- Mọi Controller đều ủy quyền bắt lỗi cho `errorMiddleware` qua `next(error)`.
- Không trả về Stack Trace ở môi trường `production`.
- Định dạng dữ liệu thống nhất:
  - `{ success: true, data: T }`
  - `{ success: false, error: { code: string, message: string, details?: unknown } }`

### 2.2 Bảo mật tầng mạng & HTTP Headers
- Tích hợp `helmet` tại đầu chuỗi Middleware của Express (`app.use(helmet())`) giúp chống các nguy cơ tấn công web phổ biến (Clickjacking, MIME Sniffing, XSS, v.v.).
- CORS được giới hạn chặt chẽ theo biến môi trường `env.CORS_ORIGIN`.

### 2.3 Bảo mật truyền thông thời gian thực Socket.IO (Khắc phục SEC-01)
- Lớp kết nối WebSocket được bảo vệ bằng middleware xác thực bắt buộc tại handshake:
  - Kiểm tra `socket.handshake.auth.token` hoặc `Authorization Bearer`.
  - Giải mã và xác thực token JWT thông qua `verifyToken()`.
  - Từ chối kết nối ngay lập tức nếu thiếu token hoặc token hết hạn, ngăn chặn việc rò rỉ dữ liệu hoặc nghe lén sự kiện bãi xe từ các client không xác thực.

### 2.4 Chuẩn hóa dữ liệu đầu vào (Data Normalization)
- `normalizeLicensePlate`: Lược bỏ các dấu gạch ngang, chấm, khoảng trắng thừa và in hoa toàn bộ trước khi lưu vào DB.
- `normalizeRfidUid`: Chuẩn hóa chuỗi UID phần cứng (Mifare RC522) về dạng Hex in hoa liền nét, đảm bảo dữ liệu quét từ MQTT và nhập từ CMS luôn khớp nhau.

---

## 3. CƠ CHẾ BẢO TOÀN NGHIỆP VỤ (BUSINESS RULES)

1. **Ràng buộc an toàn RFID**:
   - Không cho phép gán hoặc đổi phương tiện cho thẻ RFID nếu thẻ đó đang trong một phiên gửi xe chưa hoàn tất (`ACTIVE`, `PENDING_ENTRY`, `PENDING_EXIT`).
   - Thẻ bị khóa (`BLOCKED`) không được phép gán phương tiện.
2. **Quy tắc tính toán sức chứa**:
   - Khi bãi xe đã cấu hình danh sách vị trí đỗ (`parking_slots`), số liệu thời gian thực được tính từ trạng thái cảm biến và trạng thái vận hành của các slot.
   - Khi chưa cấu hình slot, hệ thống tự động fallback dựa trên `totalCapacity` và số lượng `ParkingSession` đang hoạt động.
3. **Idempotency & Data Consistency**:
   - Tên slot và biểu phí đều được ràng buộc khóa duy nhất cấp cơ sở dữ liệu (`@@unique`).
   - Mọi mức phí cấu hình và phí thanh toán đều được kiểm tra `$ \ge 0 $`.

