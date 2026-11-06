# KẾ HOẠCH TỔNG THỂ PHA 3 (PHASE 3 MASTER PLAN - FINAL TECHNICAL CORRECTION)
## QUẢN LÝ PHIÊN GỬI XE, TÍNH PHÍ & VẬN HÀNH THỦ CÔNG (PARKING SESSION MANAGEMENT, BILLING & MANUAL OPERATIONS)

> [!IMPORTANT]
> **Tài liệu quy hoạch kỹ thuật hoàn thiện (Final Technical Planning Document)**
> Văn bản này được hiệu chỉnh kỹ thuật lần cuối bởi Senior Backend Architect và PostgreSQL Transaction Specialist. Tài liệu chuẩn hóa thuật toán kiểm soát dung lượng không trùng lặp, cơ chế thanh toán phụ thu bảo toàn lịch sử, hạ tầng Idempotency trên PostgreSQL, xử lý hết hạn phiên vào (Entry Timeout) và an toàn thẻ RFID.
> **MODE: PLANNING ONLY. Tuyệt đối không can thiệp mã nguồn ứng dụng hay CSDL trong bước này.**

---

## 1. TỔNG QUAN & RANH GIỚI TRIỂN KHAI

### Mục tiêu cốt lõi:
1. **Thuật toán Kiểm soát Sức chứa Bảo thủ (Zero Double-Counting)**: Phân tách minh bạch giữa hiện trạng cảm biến vật lý và tải phiên logic, sử dụng khóa hàng bi quan PostgreSQL và một giao dịch duy nhất để ngăn ngừa tuyệt đối overbooking.
2. **Động cơ Tính phí & Bảo toàn Lịch sử Thanh toán**: Hỗ trợ `PER_VISIT` và `PER_HOUR` (làm tròn lên, tối thiểu 1 giờ, `Prisma.Decimal`). Tách biệt mốc chốt cước, thanh toán và rời bãi thực tế. Cho phép thu phụ thu quá giờ ân hạn mà **không bao giờ thu trùng khoản tiền đã trả trước đó**.
3. **Quản trị Idempotency Bền vững**: Thiết kế bảng lưu trữ `idempotency_keys` ngay trên PostgreSQL, xử lý các ca cạnh tranh cùng key, gửi lại payload khác, replay thành công và rollback giao dịch mà không cần bổ sung Redis.
4. **Vòng đời & Timeout Phiên Chờ Vào (`PENDING_ENTRY`)**: Xử lý triệt để xung đột giữa tác vụ hủy do quá giờ (Entry Timeout) và sự kiện xe thực tế đi qua barrier (`confirmEntryPassage`).
5. **Chính sách Thẻ RFID Vãng lai & Mất Thẻ**: Thẻ vãng lai vĩnh viễn không gán xe (`vehicleId == null`). Cho phép cho xe ra thủ công khi mất thẻ sau khi đối chiếu giấy tờ và lưu vết kiểm toán; **chính sách thu phí phạt mất thẻ được hoãn lại (DEFERRED), không thu phí phạt trong Phase 3**.
6. **Vận hành Thủ công An toàn**: Cho phép `manualExit` từ `ACTIVE` và `PENDING_EXIT`, cấm từ `PENDING_ENTRY`, `COMPLETED`, `CANCELLED`. Tuyệt đối không gửi lệnh điều khiển Servo qua MQTT.

---

## 2. THUẬT TOÁN TIẾP NHẬN SỨC CHỨA BẢO THỦ (ADMISSION CAPACITY ALGORITHM)

### 2.1 Nhận diện & Loại trừ Nguy cơ Đếm trùng (Double Counting & Double Subtraction)
Trong mô hình bãi xe thông minh tích hợp cảm biến ô đỗ và cổng kiểm soát RFID, các thành phần sau có nguy cơ bị đếm trùng nếu không phân định nguồn chân lý (Source of Truth):
- **Ô đỗ `MAINTENANCE` và `UNKNOWN`**: Nếu một ô đỗ vừa hỏng cảm biến (`UNKNOWN`) vừa được đặt bảo trì (`MAINTENANCE`), việc trừ cả hai sẽ làm giảm sức chứa 2 lần.
- **Xe đã đỗ vào ô (`OCCUPIED`) vs Phiên logic (`ACTIVE`)**: Một chiếc xe đã quét thẻ và đang đỗ trên ô đỗ có cảm biến sẽ đồng thời làm tăng số phiên `ACTIVE` và làm tăng số ô `OCCUPIED`. Nếu cộng dồn cả hai sẽ gây trừ trùng sức chứa.
- **Xe đang tìm chỗ (`ACTIVE` nhưng ô cảm biến vẫn `EMPTY`)**: Xe đã vào cổng nhưng đang chạy tìm ô đỗ. Cảm biến ô đỗ chưa báo `OCCUPIED`, nhưng xe đã chiếm 1 suất trong bãi.
- **Xe đang chờ vào (`PENDING_ENTRY`)**: Xe đã quẹt thẻ tại cổng, barrier đang mở, chưa vào ô đỗ. Đây là **Explicit Reservation** bắt buộc phải tính vào tải của bãi.

### 2.2 Nguồn Chân lý (Sources of Truth) & Phân rã Trạng thái Ô đỗ
Mọi ô đỗ vật lý (`ParkingSlot`) thuộc bãi đỗ xe được phân chia thành **4 tập hợp rời nhau hoàn toàn (Mutually Exclusive)**:

1. $S_{\text{maint}}$: Tập các ô đỗ có $\text{operationalStatus} == \text{'MAINTENANCE'}$.
2. $S_{\text{unknown}}$: Tập các ô đỗ có $\text{operationalStatus} \ne \text{'MAINTENANCE'}$ VÀ $\text{sensorStatus} == \text{'UNKNOWN'}$.
3. $S_{\text{phys\_occupied}}$: Tập các ô đỗ hoạt động bình thường nhưng đang có xe chiếm chỗ:
   $\text{operationalStatus} \ne \text{'MAINTENANCE'} \land \text{sensorStatus} \ne \text{'UNKNOWN'} \land (\text{operationalStatus} == \text{'OCCUPIED'} \lor \text{sensorStatus} == \text{'OCCUPIED'})$.
4. $S_{\text{phys\_free}}$: Tập các ô đỗ sẵn sàng tiếp nhận xe:
   $\text{operationalStatus} == \text{'AVAILABLE'} \land \text{sensorStatus} == \text{'EMPTY'}$.

Tổng số ô đỗ vật lý:
$$S_{\text{total}} = S_{\text{maint}} + S_{\text{unknown}} + S_{\text{phys\_occupied}} + S_{\text{phys\_free}}$$

Số ô đỗ vật lý khỏe mạnh vận hành được:
$$S_{\text{healthy}} = S_{\text{total}} - S_{\text{maint}} - S_{\text{unknown}} = S_{\text{phys\_occupied}} + S_{\text{phys\_free}}$$

### 2.3 Nguồn Chân lý Tải Phiên Logic (Logical Session Load)
Truy vấn từ bảng `parking_sessions`:
- $N_{\text{resv}}$: Số phiên giữ chỗ tại cổng vào ($\text{status} == \text{'PENDING_ENTRY'}$).
- $N_{\text{active}}$: Số phiên xe đang đỗ hoặc đang tìm chỗ ($\text{status} == \text{'ACTIVE'}$).
- $N_{\text{exit}}$: Số phiên đang chờ thanh toán tại cổng ra ($\text{status} == \text{'PENDING_EXIT'}$).

Tổng tải logic đang chiếm dụng tài nguyên bãi xe:
$$N_{\text{logical}} = N_{\text{resv}} + N_{\text{active}} + N_{\text{exit}}$$

### 2.4 Công thức Tiếp nhận Bảo thủ Tuyệt đối (Conservative Admission Formula)
Số xe đang lưu thông trong bãi nhưng chưa kích hoạt cảm biến ô đỗ (bao gồm xe giữ chỗ tại cổng, xe đang tìm chỗ, xe đang đi ra):
$$N_{\text{unslotted}} = \max(0, N_{\text{logical}} - S_{\text{phys\_occupied}})$$

Số ô đỗ vật lý thực sự còn trống và chưa bị đăng ký giữ chỗ:
$$\text{PhysicalAvailable} = S_{\text{phys\_free}} - N_{\text{unslotted}} = S_{\text{healthy}} - \max(S_{\text{phys\_occupied}}, N_{\text{logical}})$$

Số chỗ khả dụng theo giới hạn đăng ký kinh doanh của bãi:
$$\text{LogicalAvailable} = \text{lot.totalCapacity} - N_{\text{logical}}$$

**Công thức Sức chứa Khả dụng Cuối cùng ($\text{SafeAvailableSpaces}$)**:
- **Nếu bãi xe có cấu hình cảm biến từng ô ($S_{\text{total}} > 0$)**:
  $$\text{SafeAvailableSpaces} = \min\Big(\text{lot.totalCapacity} - N_{\text{logical}},\; S_{\text{healthy}} - \max(S_{\text{phys\_occupied}}, N_{\text{logical}})\Big)$$
- **Nếu bãi xe chỉ quản lý tổng thể, chưa gắn cảm biến từng ô ($S_{\text{total}} == 0$)**:
  $$\text{SafeAvailableSpaces} = \text{lot.totalCapacity} - N_{\text{logical}}$$

**Quyết định**: Cho phép tiếp nhận khi $\text{SafeAvailableSpaces} > 0$. Nếu $\le 0 \rightarrow$ ném lỗi 409 `PARKING_LOT_FULL`.

### 2.5 Thực thi Giao dịch Đơn nhất (Single Interactive Transaction)
Toàn bộ quy trình (Khóa bãi xe $\rightarrow$ Tính toán sức chứa $\rightarrow$ Kiểm tra hợp lệ xe/thẻ $\rightarrow$ Tạo phiên) được thực hiện trong duy nhất một `prisma.$transaction`:

```typescript
return await prisma.$transaction(async (tx) => {
  // 1. Khóa hàng bi quan trên bãi xe để tuần tự hóa toàn bộ yêu cầu vào
  const [lot] = await tx.$queryRaw<Array<{ id: string; totalCapacity: number; isActive: boolean }>>`
    SELECT id, "totalCapacity", "isActive"
    FROM "parking_lots"
    WHERE id = ${parkingLotId}::uuid
    FOR UPDATE
  `;
  if (!lot || !lot.isActive) {
    throw AppError.notFound('Bãi đỗ xe không tồn tại hoặc ngừng hoạt động', ErrorCodes.PARKING_LOT_NOT_FOUND);
  }

  // 2. Đếm tải phiên logic (chân lý logic)
  const logicalCount = await tx.parkingSession.count({
    where: {
      parkingLotId,
      status: { in: ['PENDING_ENTRY', 'ACTIVE', 'PENDING_EXIT'] }
    }
  });

  // 3. Đếm hiện trạng cảm biến ô đỗ (chân lý vật lý)
  const slots = await tx.parkingSlot.findMany({
    where: { parkingLotId, isActive: true },
    select: { operationalStatus: true, sensorStatus: true }
  });

  let safeAvailable = lot.totalCapacity - logicalCount;

  if (slots.length > 0) {
    let maintCount = 0;
    let unknownCount = 0;
    let physOccupiedCount = 0;

    for (const slot of slots) {
      if (slot.operationalStatus === 'MAINTENANCE') {
        maintCount++;
      } else if (slot.sensorStatus === 'UNKNOWN') {
        unknownCount++;
      } else if (slot.operationalStatus === 'OCCUPIED' || slot.sensorStatus === 'OCCUPIED') {
        physOccupiedCount++;
      }
    }

    const healthyCount = slots.length - maintCount - unknownCount;
    const physicalAvailable = healthyCount - Math.max(physOccupiedCount, logicalCount);
    safeAvailable = Math.min(safeAvailable, physicalAvailable);
  }

  if (safeAvailable <= 0) {
    throw AppError.conflict('Bãi đỗ xe đã hết chỗ trống khả dụng', ErrorCodes.PARKING_LOT_FULL);
  }

  // 4. Tiếp tục tạo phiên trong cùng transaction...
});
```

---

## 3. CƠ CHẾ THANH TOÁN BẢO TOÀN LỊCH SỬ & PHỤ THU QUÁ GIỜ

### 3.1 Nguyên tắc Tài chính: Không Thu Trùng Phí
- Khách hàng đã thanh toán 15,000 VND cho giờ đỗ đầu tiên.
- Thời gian ân hạn rời bãi: **10 phút** (giá trị đề xuất mặc định có thể cấu hình, chờ chủ dự án phê duyệt).
- Nếu khách nán lại bãi quá 10 phút và bước sang giờ thứ 2:
  - Tổng chi phí thực tế cho 2 giờ: 30,000 VND.
  - Số tiền đã thu trước đó (`paidAmount`): 15,000 VND.
  - Số tiền cần thu thêm (`amountDue`): $30,000 - 15,000 = 15,000$ VND.
  - **Tuyệt đối không yêu cầu thu lại 30,000 VND**.

### 3.2 Thiết kế Mô hình Dữ liệu Thanh toán Độc lập
Bổ sung bảng lịch sử thanh toán `parking_session_payments` kết hợp với các cột tích lũy trên `parking_sessions`:

```prisma
model ParkingSession {
  // ... các trường cơ bản ...
  totalFee      Decimal       @default(0) @db.Decimal(10, 2) // Tổng chi phí lũy kế
  paidAmount    Decimal       @default(0) @db.Decimal(10, 2) // Tổng tiền đã thực thu
  paymentStatus PaymentStatus @default(UNPAID)               // UNPAID, PAID, EXEMPT
  
  billingCutoffTime DateTime? // Mốc thời gian chốt cước gần nhất
  paymentTime       DateTime? // Mốc thời gian thanh toán gần nhất
  paymentOperatorId String?   // Thu ngân xác nhận lần gần nhất

  payments      ParkingSessionPayment[]
}

model ParkingSessionPayment {
  id          String   @id @default(uuid())
  sessionId   String   @map("session_id")
  amount      Decimal  @db.Decimal(10, 2) // Số tiền thu trong đợt này
  paymentTime DateTime @default(now()) @map("payment_time")
  operatorId  String?  @map("operator_id")
  paymentType String   @default("CASH")   // Tiền mặt tại quầy
  note        String?  // "INITIAL_PAYMENT" hoặc "OVERTIME_SURCHARGE"

  session     ParkingSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  operator    User?          @relation(fields: [operatorId], references: [id], onDelete: SetNull)

  @@index([sessionId])
  @@map("parking_session_payments")
}
```

- **Công thức tính số tiền cần thu**:
  $$\text{amountDue} = \max(0, \text{totalFee} - \text{paidAmount})$$
- **Điều kiện cho phép hoàn thành phiên (`COMPLETED`)**:
  Bắt buộc $\text{paidAmount} \ge \text{totalFee}$ VÀ $\text{amountDue} == 0$ (hoặc `paymentStatus === 'EXEMPT'`).

---

## 4. HẠ TẦNG IDEMPOTENCY TRÊN POSTGRESQL (ZERO EXTERNAL INFRASTRUCTURE)

Không sử dụng Redis để tránh overengineering. Toàn bộ tính năng Idempotency được đảm bảo qua bảng `idempotency_keys` trong PostgreSQL:

```prisma
model IdempotencyKey {
  key            String   @id // UUIDv4 từ Header Idempotency-Key
  targetPath     String   @map("target_path")
  requestHash    String   @map("request_hash") // SHA-256(method + path + userId + body)
  responseStatus Int?     @map("response_status")
  responseBody   Json?    @map("response_body")
  lockedUntil    DateTime @map("locked_until")
  createdAt      DateTime @default(now()) @map("created_at")

  @@index([createdAt])
  @@map("idempotency_keys")
}
```

### Xử lý 6 Tình huống Idempotency:
1. **Yêu cầu Đồng thời Trùng Key (Concurrent Duplicate)**:
   Request thứ nhất ghi nhận key với `lockedUntil = NOW() + 30s`. Request thứ hai gửi đến gặp khóa đang giữ sẽ nhận phản hồi HTTP 409 Conflict hoặc chờ khóa giải phóng.
2. **Cùng Key Nhưng Khác Payload (Same Key, Different Payload)**:
   So khớp `requestHash`. Nếu không khớp, từ chối ngay với lỗi 422 `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`.
3. **Phát lại Yêu cầu Thành công (Successful Replay)**:
   Nếu bản ghi đã có `responseStatus` $\ge 200$, trả về ngay bản sao kết quả cũ kèm Header `X-Idempotency-Replay: true`, không thực thi lại logic nghiệp vụ.
4. **Thử lại khi Thất bại (Failed Request Retry)**:
   Nếu giao dịch nghiệp vụ bị lỗi (500, deadlock), bản ghi key bị rollback hoặc xóa cờ khóa, cho phép client gửi lại request sạch.
5. **Giao dịch Rollback (Transaction Rollback)**:
   Giao dịch nghiệp vụ thất bại đảm bảo không lưu trạng thái nửa vời.
6. **Ràng buộc Duy nhất CSDL (Database Uniqueness)**:
   Khóa chính trên cột `key` kết hợp các Partial Unique Index trên `parking_sessions` tạo nên hệ thống phòng ngự hai lớp.

---

## 5. QUẢN TRỊ VÒNG ĐỜI VÀ TIMEOUT PHIÊN VÀO (`PENDING_ENTRY`)

### 5.1 Quy tắc Hết hạn (Entry Timeout)
- Khi xe quét thẻ tại cổng vào, phiên chuyển sang `PENDING_ENTRY`. Thời gian chờ xe qua barrier mặc định là **60 giây** (`ENTRY_TIMEOUT_SECONDS = 60`).
- Nếu xe không đi qua barrier (lùi lại hoặc chết máy), phiên phải bị hủy để giải phóng thẻ và xe.

### 5.2 Xử lý Tranh chấp Đồng thời giữa Passage Confirmation và Timeout
Tình huống: Xe vừa chạy qua barrier lúc 59.9 giây, đồng thời tác vụ Timeout quét lúc 60.0 giây.
- **Giải pháp**: Cả hai luồng bắt buộc phải mở transaction và dùng khóa dòng trên phiên:
  ```sql
  SELECT id, status FROM "parking_sessions" WHERE id = $1 FOR UPDATE;
  ```
- Nếu `confirmEntryPassage` nhận khóa trước: cập nhật `status = 'ACTIVE'`. Khi tác vụ Timeout nhận khóa sau, nó kiểm tra thấy `status !== 'PENDING_ENTRY'` $\rightarrow$ **bỏ qua, không hủy phiên**.
- Nếu tác vụ Timeout nhận khóa trước: cập nhật `status = 'CANCELLED'`. Khi `confirmEntryPassage` nhận khóa sau, thấy phiên đã hủy $\rightarrow$ từ chối xác nhận với lỗi `SESSION_ALREADY_CANCELLED`.

---

## 6. XỬ LÝ SỰ CỐ MẤT THẺ RFID VÀ AN TOÀN THẺ VÃNG LAI

1. **Thẻ Vãng lai Tái sử dụng Vô hạn**:
   Trường `RFIDCard.vehicleId` luôn bằng `null`. Partial unique index `unique_active_rfid_session` chỉ khóa thẻ khi phiên ở `PENDING_ENTRY`, `ACTIVE`, `PENDING_EXIT`. Khi phiên sang `COMPLETED` hoặc `CANCELLED`, thẻ tự do tái sử dụng.
2. **Quy trình Xử lý Khi Mất Thẻ RFID**:
   - **Chính sách phí phạt mất thẻ được HOÃN LẠI (DEFERRED)**, không áp dụng trong Phase 3.
   - Khi khách mất thẻ: Nhân viên điều hành CMS tra cứu phiên theo biển số xe (`GET /api/parking-sessions?search=<plate>`).
   - Nhân viên kiểm tra giấy tờ đăng ký xe và CCCD.
   - Thu ngân thu tiền cước đỗ xe thực tế theo giờ lưu bãi (không thu phụ phí mất thẻ).
   - Gọi `manualExit` với lý do kiểm toán bắt buộc: `"Mất thẻ vãng lai, đã xác minh CCCD và đăng ký xe, thu đúng cước đỗ xe"`.
   - Phiên chuyển sang `COMPLETED`, thẻ cũ được đánh dấu trạng thái `LOST` trong bảng `rfid_cards` để ngăn kẻ gian nhặt được quẹt vào bãi.

---

## 7. TÍNH NHẤT QUÁN CỦA MÁY TRẠNG THÁI VẬN HÀNH THỦ CÔNG

- **Cho phép `manualExit` từ**: `ACTIVE` và `PENDING_EXIT`.
- **Cấm tuyệt đối `manualExit` từ**: `PENDING_ENTRY` (phải dùng `cancelEntry`), `COMPLETED`, `CANCELLED`.
- **Điều kiện hoàn thành phiên**:
  - `vehicleDepartedConfirmed: true`.
  - $\text{amountDue} == 0$ (đã thu đủ tiền).
- **An toàn Phần cứng**: Không phát bất kỳ lệnh Servo hay MQTT GATE_COMMAND nào.
