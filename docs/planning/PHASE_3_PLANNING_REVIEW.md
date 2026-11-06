# BÁO CÁO RÀ SOÁT VÀ HIỆU CHỈNH KẾ HOẠCH PHA 3 (PHASE 3 PLANNING REVIEW)
## PARKING SESSION MANAGEMENT, BILLING & MANUAL OPERATIONS

> [!IMPORTANT]
> **Tài liệu Báo cáo Rà soát Độc lập (Independent Planning Review Report)**
> Dự án: **Smart Parking IoT — CMS Management System**
> Vai trò đánh giá: Senior Backend Architect, PostgreSQL Transaction Specialist & Smart Parking Domain Reviewer.
> Ngày thực hiện: 06/11/2026.
> Phạm vi: Rà soát và hoàn thiện toàn bộ 6 tài liệu quy hoạch kỹ thuật của Pha 3.

---

## 1. CÁC VẤN ĐỀ ĐƯỢC NHẬN DIỆN TRONG BẢN KẾ HOẠCH CŨ (PROBLEMS IDENTIFIED)

Qua kiểm toán kỹ thuật chuyên sâu đối với hồ sơ quy hoạch Pha 3 ban đầu, các khiếm khuyết và điểm thiếu sót sau đã được phát hiện:

1. **Khiếm khuyết Kiểm soát Tranh chấp Sức chứa (Admission Concurrency Defect)**:
   - Kế hoạch cũ đề xuất sử dụng khóa dòng `SELECT FOR UPDATE` trên bảng `parking_lots`, nhưng **chưa làm rõ bản chất: Khóa dòng tự nó không thể bảo vệ sức chứa**. Nếu việc kiểm tra sức chứa không diễn ra bên trong cùng một giao dịch đang giữ khóa, hoặc nếu công thức không loại trừ các ô đỗ `UNKNOWN`/`MAINTENANCE` và không đối chiếu hiện trạng chiếm chỗ vật lý với phiên logic, hệ thống vẫn có nguy cơ bị overbooking khi có 2 request đồng thời cạnh tranh chỗ đỗ cuối cùng.
2. **Thiếu Tường minh trong Quy tắc Tính phí (Billing Rule Ambiguities)**:
   - Chưa khẳng định dứt khoát ranh giới của MVP: Cần loại bỏ hoàn toàn các bậc giá lũy tiến (Progressive tiers) phức tạp.
   - Chưa chuẩn hóa chi tiết quy tắc làm tròn lên (`ceil`), khung tính tối thiểu (1 giờ) và mốc thời gian chốt cước (`billingCutoffTime`).
3. **Lỗ hổng Thời gian giữa Thanh toán và Rời bãi Thực tế (Payment vs Departure Timing Gap)**:
   - Kế hoạch cũ chưa lường trước rủi ro lái xe đã trả tiền mặt tại quầy nhưng nán lại bãi đỗ xe quá lâu (ví dụ 45–60 phút sau mới lái xe ra cổng).
   - Thiếu cơ chế Thời gian Ân hạn (Grace Period) và quy trình xử lý phát sinh cước quá giờ khi xe vượt qua ranh giới giờ đỗ tiếp theo.
4. **Ma trận Chuyển đổi Vận hành Thủ công Chưa Chuẩn hóa (Manual Exit Transition Ambiguities)**:
   - Chưa quy định rõ ràng rằng nhân viên CMS được phép gọi `manualExit` từ cả 2 trạng thái `ACTIVE` (đã trả tiền/miễn phí) và `PENDING_EXIT` (sau khi thu tiền tại barrier ra).
   - Chưa thiết lập rào cản ngăn chặn tuyệt đối việc gọi `manualExit` từ `PENDING_ENTRY` (phải dùng `cancelEntry`), `COMPLETED` và `CANCELLED`.
   - Chưa bắt buộc tham số xác nhận xe đã thực tế rời bãi (`vehicleDepartedConfirmed: true`).
5. **Rủi ro An toàn Thẻ RFID Vãng lai (RFID Safety & Lifecycle)**:
   - Chưa khẳng định nguyên tắc bất biến: Thẻ vãng lai phải luôn có `RFIDCard.vehicleId == null`.
   - Chưa làm rõ việc trạng thái `PENDING_EXIT` vẫn nằm trong phạm vi khóa của `unique_active_rfid_session`, ngăn chặn việc tái sử dụng thẻ khi xe chưa thực sự rời bãi.
   - Chưa có quy trình xử lý giải cứu cho các xe có thẻ bị khóa (`BLOCKED`) trong thời gian đang đỗ.
6. **Nhầm lẫn giữa Idempotency và Ràng buộc CSDL (Idempotency Misconceptions)**:
   - Kế hoạch cũ ngầm coi chỉ mục duy nhất là giải pháp toàn diện cho Idempotency. Tuy nhiên, chỉ mục chỉ chặn ghi trùng; hệ thống cần cơ chế Idempotency ở tầng ứng dụng (Idempotency Key, State Guard) để trả về phản hồi thành công (200 OK) khi client gửi lại request hợp lệ.

---

## 2. CÁC NỘI DUNG ĐÃ ĐƯỢC ĐIỀU CHỈNH TOÀN DIỆN (CORRECTIONS MADE)

Toàn bộ 6 tài liệu kỹ thuật trong `docs/planning/` đã được viết lại đồng bộ và nhất quán:

1. **Chuẩn hóa Thuật toán Tiếp nhận Bảo thủ trong Giao dịch Đơn nhất (Conservative Admission)**:
   - Định nghĩa rõ ràng công thức tính sức chứa an toàn:
     $$\text{effectiveCapacity} = \text{configuredSlots} - \text{maintenance} - \text{unknown}$$
     $$\text{occupiedCount} = \max(\text{logicalActiveSessions}, \text{physicallyOccupiedSlots})$$
     $$\text{availableSpaces} = \text{effectiveCapacity} - \text{occupiedCount}$$
   - Khóa bi quan `SELECT id FROM parking_lots WHERE id = $1 FOR UPDATE` bọc trọn gói: Đọc bãi xe $\rightarrow$ Đọc phiên logic $\rightarrow$ Đọc cảm biến vật lý $\rightarrow$ Quyết định $\rightarrow$ Tạo bản ghi session.
   - Thống nhất áp dụng chung một thuật toán cho cả luồng quẹt thẻ tự động (`requestEntry`) và vào thủ công (`manualEntry`).
2. **Chính sách Biểu phí MVP Đơn giản, Chặt chẽ**:
   - `PER_VISIT`: Phí cố định theo lượt.
   - `PER_HOUR`: Làm tròn lên (`ceil(durationMinutes / 60)`), tối thiểu 1 giờ.
   - Tuyệt đối không áp dụng bậc giá lũy tiến trong MVP.
   - Chụp ảnh biểu giá (`pricingRuleId`, `pricingType`, `pricingRate`) ngay tại thời điểm vào bãi. Toàn bộ tính toán sử dụng `Prisma.Decimal`.
3. **Phân tách Rạch ròi Mốc Thanh toán, Rời bãi và Chính sách Ân hạn**:
   - Bổ sung 5 trường dữ liệu chuyên biệt: `billingCutoffTime`, `totalFee`, `paymentStatus`, `paymentTime`, `exitTime`.
   - Thiết lập chính sách **Thời gian Ân hạn Rời bãi (`EXIT_GRACE_PERIOD_MINUTES`)**: Đề xuất mặc định **15 phút**.
   - Thiết lập quy trình tái tính phí: Nếu xe ra quá thời gian ân hạn và vượt sang giờ tính phí mới $\rightarrow$ Phát sinh phụ thu, đưa `paymentStatus` về `UNPAID`, chặn barrier ra cho đến khi thanh toán xong.
4. **Chuẩn hóa Máy trạng thái và Vận hành Thủ công**:
   - Cho phép `manualExit` từ `ACTIVE` và `PENDING_EXIT`.
   - Chặn tuyệt đối `manualExit` từ `PENDING_ENTRY`, `COMPLETED`, `CANCELLED`.
   - Bắt buộc xác thực JWT, ghi nhận `operatorId`, lý do `manualExitReason` $\ge 5$ ký tự, và cờ `vehicleDepartedConfirmed: true`.
   - Khẳng định nguyên tắc an toàn phần cứng: Thao tác thủ công CMS **tuyệt đối không gửi bản tin GATE_COMMAND và không điều khiển Servo**.
5. **Bảo đảm An toàn Tuyệt đối cho Thẻ RFID**:
   - Thẻ vãng lai luôn giữ `vehicleId == null`.
   - Partial Unique Index `unique_active_rfid_session` giữ thẻ bị khóa trong suốt các trạng thái `PENDING_ENTRY`, `ACTIVE` và `PENDING_EXIT`. Thẻ chỉ tự động giải phóng khi phiên đạt `COMPLETED` hoặc `CANCELLED`.
   - Thẻ bị `BLOCKED` bị chặn tại cổng vào; xe có thẻ bị khóa bên trong bãi được giải cứu thông qua quy trình `manualExit` có kiểm toán.
6. **Kiến trúc Idempotency Đa tầng**:
   - Tầng 1: Client Request Header `Idempotency-Key: <UUID>`.
   - Tầng 2: State Guard trên Service (trả về kết quả hiện tại thay vì ném lỗi khi gặp request hợp lệ gửi lặp lại).
   - Tầng 3: Database Partial Unique Indexes & Transaction Locks.
7. **Bổ sung Bộ Kiểm thử Tranh chấp Đồng thời trên PostgreSQL Thật**:
   - Bổ sung kịch bản `CON-01`: Bắn 10 request đồng thời khi bãi chỉ còn 1 chỗ trống duy nhất $\rightarrow$ Chính xác 1 request thành công, 9 request nhận lỗi 409 `PARKING_LOT_FULL`.
   - Bổ sung kịch bản `CON-02`: Tranh chấp quẹt thẻ vãng lai đồng thời.
   - Bổ sung kịch bản `CON-03`: Tranh chấp xác nhận thanh toán tiền mặt.

---

## 3. CÁC QUYẾT ĐỊNH NGHIỆP VỤ MỞ CẦN CHỦ DỰ ÁN PHÊ DUYỆT (OPEN BUSINESS DECISIONS)

Dưới đây là 3 quyết định chính sách đang được thiết lập dưới dạng giả định lập trình (Planning Assumptions) và cần chủ dự án xác nhận trước khi đưa vào vận hành thực tế:

| STT | Quyết định nghiệp vụ | Đề xuất kỹ thuật (Planning Assumption) | Các phương án lựa chọn |
| :---: | :--- | :--- | :--- |
| **1** | **Thời lượng Ân hạn Rời bãi (Grace Period Duration)** | **15 phút** kể từ thời điểm nhân viên thu ngân bấm xác nhận thu tiền mặt. | - Phương án A: 10 phút (bãi nhỏ, ít ùn ứ)<br>- Phương án B: 15 phút (khuyến nghị)<br>- Phương án C: 20 phút (bãi rộng, nhiều tầng) |
| **2** | **Xử lý Xe Quá hạn Ân hạn Vượt sang Giờ Mới** | **Chặn xuất bãi, yêu cầu thu thêm cước chênh lệch** và bấm xác nhận thanh toán lần 2 trước khi mở barrier. | - Phương án A: Thu thêm tiền nghiêm ngặt (Khuyến nghị để tránh thất thoát)<br>- Phương án B: Cho qua và chỉ ghi cảnh báo trên hệ thống |
| **3** | **Chính sách Xử lý Mất Thẻ Vãng Lai (Lost Card Policy)** | Nhân viên trực đối chiếu đăng ký xe, thu tiền đỗ xe thực tế và **thu thêm phí phạt mất thẻ cố định (ví dụ: 50,000 VND)** thông qua manual-exit. | - Phương án A: Thu cước gửi xe + Phạt cố định mất thẻ (Khuyến nghị)<br>- Phương án B: Chỉ thu cước gửi xe thực tế |

---

## 4. TIÊU CHUẨN NGHIỆM THU ĐƯỢC CẬP NHẬT (UPDATED ACCEPTANCE CRITERIA)

Khi bước vào giai đoạn lập trình mã nguồn ở phiên tiếp theo, việc nghiệm thu Pha 3 phải thỏa mãn đồng thời các tiêu chí sau:

1. **Kiểm thử Tự động (Automated Tests)**:
   - Toàn bộ ~30 bài test mới của Pha 3 đạt 100% (Green).
   - Test tranh chấp đồng thời `session-concurrency.test.ts` chạy thành công trên PostgreSQL container thực tế.
   - Toàn bộ 59 tests của Pha 0, 1, 2 tiếp tục đạt 100% (Zero regressions).
2. **Chất lượng Mã nguồn**:
   - `npm run typecheck`: **0 lỗi** (TypeScript Strict mode).
   - `npm run lint`: **0 lỗi, 0 cảnh báo**.
3. **Đóng gói Ứng dụng**:
   - `npm run build` trên cả `backend` và `frontend` thành công không có lỗi.
4. **An toàn Hệ thống**:
   - Không có bất kỳ lệnh điều khiển Servo hay MQTT GATE_COMMAND nào được phát ra từ module vận hành thủ công CMS.

---

## 5. ĐÁNH GIÁ MỨC ĐỘ SẴN SÀNG TRIỂN KHAI (IMPLEMENTATION READINESS)

- **Tính toàn vẹn Tài liệu**: 6 tài liệu kỹ thuật chuyên đề đã được cập nhật đồng bộ 100%, không còn bất kỳ mâu thuẫn nào giữa State Machine, API Contract, Database Schema và Test Plan.
- **Tính khả thi Kỹ thuật**: Các giải pháp về Concurrency, Billing Snapshot, Idempotency và Grace Period hoàn toàn nằm trong năng lực của stack công nghệ hiện hữu (Node.js, Express, TypeScript, PostgreSQL 16, Prisma).
- **Ranh giới Pha**: Giữ nguyên vẹn tính độc lập, sẵn sàng để Pha 4 (MQTT Worker) và Pha 5 (React CMS) kết nối trực tiếp.

---

## 🎯 PHÁN QUYẾT CUỐI CÙNG (FINAL VERDICT)

```
========================================================================================
                          PHASE 3 PLANNING VERDICT: READY
========================================================================================
- Tất cả các khiếm khuyết về Concurrency, Billing, Payment Timing, Manual Exit, RFID
  và Idempotency đã được khắc phục triệt để.
- Hồ sơ quy hoạch đã sẵn sàng 100% để chuyển sang giai đoạn lập trình mã nguồn (Implementation).
- Trạng thái Workspace: Không có mã nguồn ứng dụng nào bị thay đổi.
========================================================================================
```

