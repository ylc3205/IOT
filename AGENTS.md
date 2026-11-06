# SMART PARKING IOT — AGENT CODING STANDARDS & WORKFLOW GUIDELINES

Tài liệu này quy định các nguyên tắc, chuẩn mực lập trình và quy trình thao tác bắt buộc cho các AI Coding Agents trong các pha triển khai tiếp theo của dự án **Smart Parking IoT**.

---

## 1. NGUYÊN TẮC CỐT LÕI (CORE PRINCIPLES)

1. **Đơn giản & Thực dụng (Keep It Simple & Pragmatic)**:
   - Dự án hướng tới hoàn thiện trong 2–3 tuần. Ưu tiên giải pháp rõ ràng, dễ bảo trì, dễ sửa lỗi khi làm việc thực tế với phần cứng.
   - Tuyệt đối không overengineer (không chuyển đổi sang Microservices, không bổ sung Redis/Kafka khi Mosquitto và PostgreSQL đã giải quyết tốt).
2. **Kiến trúc Modular Monolith**:
   - Backend phục vụ cả Web CMS và khả năng mở rộng Mobile trong tương lai qua REST API.
   - Giữ các phân hệ (`modules/`) độc lập logic nhưng cùng chia sẻ kết nối cơ sở dữ liệu và hạ tầng thông điệp.
3. **Trung thực về dữ liệu (Data Integrity & Honesty)**:
   - Tuyệt đối không sinh dữ liệu giả lập (mock data) trá hình dưới dạng dữ liệu thật trên CMS. Nếu một tính năng chưa tích hợp phần cứng, phải hiển thị trạng thái Placeholder rõ ràng.
4. **Bảo toàn Git**:
   - Tuyệt đối không chạy các lệnh Git mang tính phá hủy (`git reset --hard`, `git clean -f`).
   - Không tự ý commit hoặc push mã nguồn nếu không có yêu cầu cụ thể từ người dùng.

---

## 2. QUY CHUẨN BACKEND (NODE.JS & TYPESCRIPT)

1. **TypeScript Strict Mode**:
   - Luôn bật cấu hình strict nhất trong `tsconfig.json`. Tuyệt đối tránh sử dụng kiểu `any`. Định nghĩa Interface/Type rõ ràng.
2. **Tách biệt Bootstrap**:
   - Cấu hình Express middleware nằm trong `app.ts`. Khởi chạy socket và mạng nằm trong `server.ts`.
3. **Định dạng phản hồi API**:
   - Thành công:
     ```json
     { "success": true, "data": {} }
     ```
   - Thất bại:
     ```json
     { "success": false, "error": { "code": "ERROR_CODE", "message": "Mô tả lỗi" } }
     ```
4. **Quy tắc an ninh MQTT**:
   - Không chứa username/password trong code; luôn đọc từ `env.ts`.
   - **Cấm cờ retain**: Tuyệt đối không được bật cờ `retain: true` khi publish các lệnh điều khiển cổng (`GATE_COMMAND` / `OPEN_GATE` / `CLOSE_GATE`).
5. **Prisma ORM**:
   - Mọi thay đổi schema cơ sở dữ liệu phải được thực thi qua lệnh `npx prisma migrate dev --name <migration_name>`.
   - Không sửa đổi trực tiếp các file SQL migration đã được áp dụng.

---

## 3. QUY CHUẨN FRONTEND (REACT & CMS)

1. **Kiến trúc Component**:
   - Phân cấp rõ rệt: `components/ui/` (nguyên tử), `components/common/` (dùng chung), `layouts/` (khung giao diện), `features/` (trang nghiệp vụ).
2. **Quản lý dữ liệu máy chủ (Server State)**:
   - Sử dụng **TanStack Query** (`@tanstack/react-query`) cho mọi thao tác gọi API Backend.
   - Tận dụng `refetchInterval` và cơ chế stale time hợp lý thay vì dùng `useEffect` gọi API thủ công.
3. **Xử lý biểu mẫu (Forms)**:
   - Sử dụng **React Hook Form** kết hợp **Zod Resolver** (`@hookform/resolvers/zod`) cho việc xác thực form nhập liệu (thêm thẻ RFID, tạo tài khoản).
4. **Giao diện người dùng**:
   - Sử dụng Tailwind CSS đồng bộ hệ màu với hệ thống thiết kế shadcn/ui.
   - Đảm bảo có đầy đủ trạng thái: Loading (Spinner/Skeleton), Error (Fallback), Empty State.

---

## 4. QUY CHUẨN CHÚ THÍCH MÃ NGUỒN (EDUCATIONAL COMMENTS)

Sử dụng chú thích bằng tiếng Việt mang tính giáo dục/giải thích lý do kỹ thuật đối với:
- Các quyết định kiến trúc quan trọng.
- Xử lý kết nối, tự phục hồi mạng và quản lý vòng đời MQTT.
- Logic bắt lỗi và trả về mã lỗi có ngữ nghĩa.
- Các hành vi liên quan đến bảo mật và an toàn phần cứng barrier.
- Không chú thích rườm rà ở các đoạn mã hiển nhiên.

