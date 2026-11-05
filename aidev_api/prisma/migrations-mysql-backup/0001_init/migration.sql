-- Migration initiale : tables users, students, sprints, enrollments, payments
-- Conforme au cahier des charges v1.0 (MySQL + Prisma, montants entiers XOF).

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(190) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('ADMIN') NOT NULL DEFAULT 'ADMIN',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS `students` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(190) NOT NULL UNIQUE,
  `phone` VARCHAR(30) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `students_email_idx` (`email`),
  INDEX `students_phone_idx` (`phone`)
);

CREATE TABLE IF NOT EXISTS `sprints` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(190) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `price_xof` INT NOT NULL,
  `minimum_payment_xof` INT NOT NULL,
  `start_at` DATETIME(3) NOT NULL,
  `end_at` DATETIME(3) NOT NULL,
  `capacity` INT NULL,
  `status` ENUM('DRAFT','ACTIVE','INACTIVE','COMPLETED') NOT NULL DEFAULT 'DRAFT',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `sprints_status_idx` (`status`),
  CONSTRAINT `chk_sprint_price` CHECK (`price_xof` > 0),
  CONSTRAINT `chk_sprint_minimum` CHECK (`minimum_payment_xof` > 0)
);

CREATE TABLE IF NOT EXISTS `enrollments` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL,
  `sprint_id` INT NOT NULL,
  `total_amount_xof` INT NOT NULL,
  `status` ENUM('PENDING','CONFIRMED','CANCELLED','COMPLETED') NOT NULL DEFAULT 'PENDING',
  `tracking_token_hash` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT `enrollments_student_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `enrollments_sprint_fk` FOREIGN KEY (`sprint_id`) REFERENCES `sprints`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY `enrollments_student_sprint_unique` (`student_id`, `sprint_id`),
  INDEX `enrollments_student_idx` (`student_id`),
  INDEX `enrollments_sprint_idx` (`sprint_id`),
  INDEX `enrollments_status_idx` (`status`),
  CONSTRAINT `chk_enrollment_amount` CHECK (`total_amount_xof` > 0)
);

CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `enrollment_id` INT NOT NULL,
  `amount_xof` INT NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'XOF',
  `reference` VARCHAR(100) NOT NULL UNIQUE,
  `provider_reference` VARCHAR(100) NULL,
  `status` ENUM('PENDING','SUCCESS','FAILED','ABANDONED') NOT NULL DEFAULT 'PENDING',
  `authorization_url` TEXT NULL,
  `paid_at` DATETIME(3) NULL,
  `provider_response` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT `payments_enrollment_fk` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `payments_enrollment_idx` (`enrollment_id`),
  INDEX `payments_status_idx` (`status`),
  INDEX `payments_created_idx` (`created_at`),
  INDEX `payments_provider_ref_idx` (`provider_reference`),
  CONSTRAINT `chk_payment_amount` CHECK (`amount_xof` > 0)
);
