ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "receipt_sent_at" TIMESTAMP(3);
