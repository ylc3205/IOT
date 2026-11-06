# THIẾT KẾ MỞ RỘNG CƠ SỞ DỮ LIỆU PHA 3 (PHASE 3 DATABASE CHANGES - FINAL)
## BẢO TOÀN LỊCH SỬ THANH TOÁN, IDEMPOTENCY VÀ VẾT KIỂM TOÁN VẬN HÀNH

> [!NOTE]
> Tài liệu này chuẩn hóa toàn bộ thay đổi cơ sở dữ liệu cho Pha 3, bao gồm việc bổ sung bảng lịch sử thanh toán `parking_session_payments`, bảng kiểm soát trùng lặp `idempotency_keys`, và các trường mở rộng trên `parking_sessions`.

---

## 1. MÔ HÌNH PRISMA SCHEMA CHI TIẾT CHO PHA 3

### 1.1 Mở rộng Thực thể `ParkingSession`
```prisma
model ParkingSession {
  id            String               @id @default(uuid())
  parkingLotId  String
  vehicleId     String
  rfidCardId    String
  entryTime     DateTime             @default(now()) // Mốc vào bãi
  exitTime      DateTime?            // Mốc xe thực tế rời bãi
  status        ParkingSessionStatus @default(ACTIVE)
  
  // 1. Snapshot biểu giá tại thời điểm vào bãi
  pricingRuleId String?
  pricingType   PricingType?
  pricingRate   Decimal?             @db.Decimal(10, 2)

  // 2. Chốt cước và thời lượng tính tiền
  billingCutoffTime DateTime?
  durationMinutes   Int?
  billableHours     Int?

  // 3. Quản lý tài chính lũy kế (Không thu trùng tiền)
  totalFee          Decimal       @default(0) @db.Decimal(10, 2) // Tổng cước phát sinh
  paidAmount        Decimal       @default(0) @db.Decimal(10, 2) // Tổng tiền đã thực thu
  paymentStatus     PaymentStatus @default(UNPAID)               // UNPAID, PAID, EXEMPT
  paymentTime       DateTime?     // Thời điểm thanh toán gần nhất
  paymentOperatorId String?       // Thu ngân xác nhận gần nhất

  // 4. Vết kiểm toán vào thủ công
  isManualEntry         Boolean @default(false)
  manualEntryReason     String?
  manualEntryOperatorId String?

  // 5. Vết kiểm toán ra thủ công
  isManualExit         Boolean @default(false)
  manualExitReason     String?
  manualExitOperatorId String?

  // 6. Thông tin hủy phiên
  cancelledAt  DateTime?
  cancelReason String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Quan hệ khóa ngoại
  parkingLot            ParkingLot              @relation(fields: [parkingLotId], references: [id], onDelete: Restrict)
  vehicle               Vehicle                 @relation(fields: [vehicleId], references: [id], onDelete: Restrict)
  rfidCard              RFIDCard                @relation(fields: [rfidCardId], references: [id], onDelete: Restrict)
  manualEntryOperator   User?                   @relation("ManualEntrySessions", fields: [manualEntryOperatorId], references: [id], onDelete: SetNull)
  manualExitOperator    User?                   @relation("ManualExitSessions", fields: [manualExitOperatorId], references: [id], onDelete: SetNull)
  paymentOperator       User?                   @relation("PaymentReceivedSessions", fields: [paymentOperatorId], references: [id], onDelete: SetNull)
  payments              ParkingSessionPayment[]

  @@index([status])
  @@index([entryTime])
  @@index([parkingLotId, status])
  @@index([vehicleId])
  @@index([rfidCardId])
  @@index([isManualEntry])
  @@index([isManualExit])
  @@map("parking_sessions")
}
```

### 1.2 Thực thể Lịch sử Thanh toán `ParkingSessionPayment`
Bảo toàn 100% lịch sử các lần thu tiền (thanh toán lần đầu và phụ thu quá hạn), đảm bảo không thu trùng:
```prisma
model ParkingSessionPayment {
  id          String   @id @default(uuid())
  sessionId   String   @map("session_id")
  amount      Decimal  @db.Decimal(10, 2) // Số tiền thu trong đợt này
  paymentTime DateTime @default(now()) @map("payment_time")
  operatorId  String?  @map("operator_id")
  paymentType String   @default("CASH")   // Tiền mặt tại quầy
  note        String?  // Ghi chú (VD: "INITIAL_PAYMENT", "OVERTIME_SURCHARGE")
  createdAt   DateTime @default(now()) @map("created_at")

  session  ParkingSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  operator User?          @relation(fields: [operatorId], references: [id], onDelete: SetNull)

  @@index([sessionId])
  @@map("parking_session_payments")
}
```

### 1.3 Thực thể Kiểm soát Trùng lặp `IdempotencyKey`
Quản trị Idempotency trực tiếp trong PostgreSQL mà không cần bổ sung Redis:
```prisma
model IdempotencyKey {
  key            String   @id // Client UUIDv4 từ Header Idempotency-Key
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

---

## 2. KẾ HOẠCH MIGRATION SQL

```sql
-- AlterTable parking_sessions
ALTER TABLE "parking_sessions"
  ADD COLUMN "pricingRuleId" TEXT,
  ADD COLUMN "pricingType" "PricingType",
  ADD COLUMN "pricingRate" DECIMAL(10,2),
  ADD COLUMN "billingCutoffTime" TIMESTAMP(3),
  ADD COLUMN "durationMinutes" INTEGER,
  ADD COLUMN "billableHours" INTEGER,
  ADD COLUMN "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "isManualEntry" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "manualEntryReason" TEXT,
  ADD COLUMN "manualEntryOperatorId" TEXT,
  ADD COLUMN "isManualExit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "manualExitReason" TEXT,
  ADD COLUMN "manualExitOperatorId" TEXT,
  ADD COLUMN "paymentTime" TIMESTAMP(3),
  ADD COLUMN "paymentOperatorId" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelReason" TEXT;

-- CreateTable parking_session_payments
CREATE TABLE "parking_session_payments" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "payment_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operator_id" TEXT,
  "paymentType" TEXT NOT NULL DEFAULT 'CASH',
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "parking_session_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable idempotency_keys
CREATE TABLE "idempotency_keys" (
  "key" TEXT NOT NULL,
  "target_path" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "response_status" INTEGER,
  "response_body" JSONB,
  "locked_until" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateIndexes
CREATE INDEX "parking_sessions_isManualEntry_idx" ON "parking_sessions"("isManualEntry");
CREATE INDEX "parking_sessions_isManualExit_idx" ON "parking_sessions"("isManualExit");
CREATE INDEX "parking_session_payments_session_id_idx" ON "parking_session_payments"("session_id");
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");

-- ForeignKeys
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_manualEntryOperatorId_fkey" FOREIGN KEY ("manualEntryOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_manualExitOperatorId_fkey" FOREIGN KEY ("manualExitOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_paymentOperatorId_fkey" FOREIGN KEY ("paymentOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "parking_session_payments" ADD CONSTRAINT "parking_session_payments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "parking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parking_session_payments" ADD CONSTRAINT "parking_session_payments_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```
