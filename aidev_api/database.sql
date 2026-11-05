
CREATE DATABASE IF NOT EXISTS sprint_platform
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE sprint_platform;

-- =========================================
-- 1. ADMINISTRATEURS
-- =========================================
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

-- =========================================
-- 2. ETUDIANTS
-- =========================================
CREATE TABLE students (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    phone VARCHAR(30) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

-- =========================================
-- 3. SPRINTS / FORMATIONS
-- =========================================
CREATE TABLE sprints (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(12,2) NOT NULL,
    status ENUM('DRAFT','ACTIVE','INACTIVE')
        NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_sprint_price CHECK (price > 0)
);

-- =========================================
-- 4. INSCRIPTIONS
-- =========================================
CREATE TABLE enrollments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_id BIGINT UNSIGNED NOT NULL,
    sprint_id BIGINT UNSIGNED NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    status ENUM('PENDING','CONFIRMED','CANCELLED')
        NOT NULL DEFAULT 'PENDING',
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_enrollment_student
        FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_enrollment_sprint
        FOREIGN KEY (sprint_id)
        REFERENCES sprints(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_enrollment_amount
        CHECK (total_amount > 0),

    INDEX idx_enrollment_student (student_id),
    INDEX idx_enrollment_sprint (sprint_id),
    INDEX idx_enrollment_status (status)
);

-- =========================================
-- 5. PAIEMENTS / PAYSTACK
-- =========================================
CREATE TABLE payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    enrollment_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reference VARCHAR(100) NOT NULL UNIQUE,
    status ENUM('PENDING','SUCCESS','FAILED','ABANDONED')
        NOT NULL DEFAULT 'PENDING',
    paid_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_payment_enrollment
        FOREIGN KEY (enrollment_id)
        REFERENCES enrollments(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_payment_amount CHECK (amount > 0),

    INDEX idx_payment_enrollment (enrollment_id),
    INDEX idx_payment_status (status),
    INDEX idx_payment_paid_at (paid_at)
);

-- =========================================
-- 6. VUE POUR LE SUIVI DES SOLDES
-- =========================================
CREATE VIEW v_enrollment_balances AS
SELECT
    e.id AS enrollment_id,
    s.id AS student_id,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
    s.email,
    s.phone,
    sp.id AS sprint_id,
    sp.name AS sprint_name,
    e.total_amount,
    COALESCE(
        SUM(
            CASE
                WHEN p.status = 'SUCCESS' THEN p.amount
                ELSE 0
            END
        ), 0
    ) AS total_paid,
    e.total_amount - COALESCE(
        SUM(
            CASE
                WHEN p.status = 'SUCCESS' THEN p.amount
                ELSE 0
            END
        ), 0
    ) AS remaining_amount,
    e.status AS enrollment_status,
    e.enrolled_at
FROM enrollments e
JOIN students s ON s.id = e.student_id
JOIN sprints sp ON sp.id = e.sprint_id
LEFT JOIN payments p ON p.enrollment_id = e.id
GROUP BY
    e.id,
    s.id,
    s.first_name,
    s.last_name,
    s.email,
    s.phone,
    sp.id,
    sp.name,
    e.total_amount,
    e.status,
    e.enrolled_at;

-- =========================================
-- 7. VUE POUR LE MINI-DASHBOARD
-- =========================================
CREATE VIEW v_admin_dashboard AS
SELECT
    (SELECT COUNT(*) FROM students) AS total_students,

    (SELECT COUNT(*) FROM sprints
        WHERE status = 'ACTIVE') AS active_sprints,

    (SELECT COUNT(*) FROM enrollments
        WHERE status <> 'CANCELLED') AS total_enrollments,

    (SELECT COALESCE(SUM(amount), 0)
        FROM payments
        WHERE status = 'SUCCESS') AS total_collected,

    (
        SELECT COALESCE(SUM(remaining_amount), 0)
        FROM v_enrollment_balances
        WHERE enrollment_status <> 'CANCELLED'
    ) AS total_remaining,

    (SELECT COUNT(*) FROM payments
        WHERE status = 'PENDING') AS pending_payments;

-- =========================================
-- 8. EXEMPLES DE REQUETES
-- =========================================

-- Consulter les chiffres du dashboard :
-- SELECT * FROM v_admin_dashboard;

-- Consulter les soldes de toutes les inscriptions :
-- SELECT * FROM v_enrollment_balances;

-- Consulter l'historique des paiements :
-- SELECT * FROM payments ORDER BY created_at DESC;

-- Consulter les sprints actifs :
-- SELECT * FROM sprints WHERE status = 'ACTIVE';
