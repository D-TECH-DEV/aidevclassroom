-- Permet à un participant dont le dossier a été annulé de reprendre une nouvelle inscription sur le même sprint.
DROP INDEX IF EXISTS "enrollments_student_id_sprint_id_key";
CREATE INDEX IF NOT EXISTS "enrollments_student_id_sprint_id_idx" ON "enrollments"("student_id", "sprint_id");
CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_active_student_sprint_key"
  ON "enrollments"("student_id", "sprint_id")
  WHERE "status" <> 'CANCELLED';
