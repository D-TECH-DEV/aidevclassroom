CREATE TABLE "sprint_notifications" (
    "id" SERIAL NOT NULL,
    "sprint_id" INTEGER NOT NULL,
    "kind" VARCHAR(60) NOT NULL,
    "note" TEXT,
    "sent_count" INTEGER NOT NULL,
    "failed_count" INTEGER NOT NULL,
    "recipients" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprint_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sprint_notifications_sprint_id_idx" ON "sprint_notifications"("sprint_id");
CREATE INDEX "sprint_notifications_created_at_idx" ON "sprint_notifications"("created_at");

ALTER TABLE "sprint_notifications"
  ADD CONSTRAINT "sprint_notifications_sprint_id_fkey"
  FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
