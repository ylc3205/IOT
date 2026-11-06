-- AlterTable
ALTER TABLE "parking_sessions" ADD COLUMN     "billableHours" INTEGER,
ADD COLUMN     "billingCutoffTime" TIMESTAMP(3),
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "isManualEntry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isManualExit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manualEntryOperatorId" TEXT,
ADD COLUMN     "manualEntryReason" TEXT,
ADD COLUMN     "manualExitOperatorId" TEXT,
ADD COLUMN     "manualExitReason" TEXT,
ADD COLUMN     "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentOperatorId" TEXT,
ADD COLUMN     "paymentTime" TIMESTAMP(3),
ADD COLUMN     "pricingRate" DECIMAL(10,2),
ADD COLUMN     "pricingRuleId" TEXT,
ADD COLUMN     "pricingType" "PricingType";

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE INDEX "parking_session_payments_session_id_idx" ON "parking_session_payments"("session_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");

-- CreateIndex
CREATE INDEX "parking_sessions_isManualEntry_idx" ON "parking_sessions"("isManualEntry");

-- CreateIndex
CREATE INDEX "parking_sessions_isManualExit_idx" ON "parking_sessions"("isManualExit");

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_manualEntryOperatorId_fkey" FOREIGN KEY ("manualEntryOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_manualExitOperatorId_fkey" FOREIGN KEY ("manualExitOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_paymentOperatorId_fkey" FOREIGN KEY ("paymentOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_session_payments" ADD CONSTRAINT "parking_session_payments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "parking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_session_payments" ADD CONSTRAINT "parking_session_payments_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
