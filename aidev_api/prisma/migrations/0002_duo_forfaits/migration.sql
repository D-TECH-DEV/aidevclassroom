-- Forfaits Single/Duo : prix duo sur Sprint, plan + binome sur Enrollment
CREATE TYPE "EnrollmentPlan" AS ENUM ('SINGLE', 'DUO');

ALTER TABLE "sprints" ADD COLUMN "duo_price_xof" INTEGER;
ALTER TABLE "sprints" ADD COLUMN "duo_minimum_payment_xof" INTEGER;

ALTER TABLE "enrollments" ADD COLUMN "plan" "EnrollmentPlan" NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "enrollments" ADD COLUMN "partner_first_name" VARCHAR(100);
ALTER TABLE "enrollments" ADD COLUMN "partner_last_name" VARCHAR(100);
