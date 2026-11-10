-- E-mail du binome (forfait DUO) : les deux adresses retrouvent le dossier via /enrollments/by-email
ALTER TABLE "enrollments" ADD COLUMN "partner_email" VARCHAR(190);

CREATE INDEX "enrollments_partner_email_idx" ON "enrollments"("partner_email");
