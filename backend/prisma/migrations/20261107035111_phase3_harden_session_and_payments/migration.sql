-- DropForeignKey
ALTER TABLE "parking_session_payments" DROP CONSTRAINT "parking_session_payments_session_id_fkey";

-- DropForeignKey
ALTER TABLE "parking_sessions" DROP CONSTRAINT "parking_sessions_rfidCardId_fkey";

-- AlterTable
ALTER TABLE "parking_sessions" ALTER COLUMN "rfidCardId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_rfidCardId_fkey" FOREIGN KEY ("rfidCardId") REFERENCES "rfid_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_session_payments" ADD CONSTRAINT "parking_session_payments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "parking_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Recreate unique_active_rfid_session to explicitly handle nullable rfidCardId
DROP INDEX IF EXISTS "unique_active_rfid_session";
CREATE UNIQUE INDEX "unique_active_rfid_session" ON "parking_sessions" ("rfidCardId") WHERE "status" IN ('ACTIVE', 'PENDING_ENTRY', 'PENDING_EXIT') AND "rfidCardId" IS NOT NULL;
