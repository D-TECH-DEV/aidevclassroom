-- AlterTable
ALTER TABLE "sprints"
ADD COLUMN "city" VARCHAR(100),
ADD COLUMN "location" VARCHAR(255),
ADD COLUMN "format" VARCHAR(120),
ADD COLUMN "level" VARCHAR(120),
ADD COLUMN "modules" JSONB;

-- CreateTable
CREATE TABLE "site_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "whatsapp_display" VARCHAR(30) NOT NULL,
    "whatsapp_href" VARCHAR(255) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainers" (
    "id" SERIAL NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(120) NOT NULL,
    "role" VARCHAR(160) NOT NULL,
    "photo_path" VARCHAR(255),
    "badge_path" VARCHAR(255),
    "bio" TEXT NOT NULL,
    "github_url" VARCHAR(255),
    "linkedin_url" VARCHAR(255),
    "portfolio_url" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" SERIAL NOT NULL,
    "question" VARCHAR(255) NOT NULL,
    "answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trainers_sort_order_idx" ON "trainers"("sort_order");

-- CreateIndex
CREATE INDEX "faqs_sort_order_idx" ON "faqs"("sort_order");
