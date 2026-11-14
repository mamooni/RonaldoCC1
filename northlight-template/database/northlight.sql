-- ===========================================================================
--  Northlight — MySQL / MariaDB schema and starter data
--  Generated for the Northlight server (server/app.py, NL_DB_KIND=mysql)
--
--  How to import (XAMPP on your laptop)
--  ------------------------------------
--  1. Start XAMPP → Start "Apache" (only if you want phpMyAdmin) and "MySQL".
--  2. Open  http://localhost/phpmyadmin  →  Import  →  choose this file  →  Go
--     (Leave "Create database if it does not exist" alone: the file does it.)
--  3. Point the server at it:
--
--        cd northlight-template
--        NL_DB_KIND=mysql \
--        NL_MYSQL_USER=root NL_MYSQL_PASSWORD= \
--        NL_MYSQL_DATABASE=northlight \
--        PORT=8000 python3 server/app.py
--
--     On Windows (cmd), one line:
--
--        set NL_DB_KIND=mysql && set NL_MYSQL_USER=root && set NL_MYSQL_DATABASE=northlight && python server\app.py
--
--  The file only creates objects that do not exist yet (CREATE ... IF NOT
--  EXISTS), so importing it twice will not delete anything.
--
--  Notes
--  -----
--  * Times are Unix seconds (BIGINT), exactly like the SQLite version.
--  * Money is whole cents (BIGINT): $74.00 is 7400. No floats near money.
--  * Usernames and e-mails are unique case-insensitively because the tables
--    use utf8mb4_unicode_ci, which matches the old SQLite COLLATE NOCASE.
--  * The admin account is NOT in this file: the server creates it on first
--    start from NL_ADMIN_PASSWORD (default "Admin!2345" — change it).
--  * Users register themselves on signup.html; nobody else is seeded.
-- ===========================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `northlight`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `northlight`;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username`      VARCHAR(32)  NOT NULL,
    `email`         VARCHAR(190) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,          -- scrypt$n$r$p$salt$hash
    `created_at`    BIGINT       NOT NULL,          -- Unix seconds
    `role`          ENUM('user','admin') NOT NULL DEFAULT 'user',
    `balance_cents` BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `users_username` (`username`),
    UNIQUE KEY `users_email` (`email`),
    CONSTRAINT `users_balance_positive` CHECK (`balance_cents` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Sessions (a cookie token is stored only as a SHA-256 hash)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sessions` (
    `token_hash` CHAR(64)     NOT NULL,
    `user_id`    INT UNSIGNED NOT NULL,
    `expires_at` BIGINT       NOT NULL,
    `created_at` BIGINT       NOT NULL,
    PRIMARY KEY (`token_hash`),
    KEY `sessions_user` (`user_id`),
    CONSTRAINT `sessions_user_fk` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Deposits — a visitor asks, an admin decides, the wallet moves once
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`      INT UNSIGNED NOT NULL,
    `amount_cents` BIGINT       NOT NULL,
    `asset`        VARCHAR(12)  NOT NULL DEFAULT 'USDT',
    `network`      VARCHAR(12)  NOT NULL DEFAULT 'TRC-20',
    `status`       ENUM('pending','confirmed','failed') NOT NULL DEFAULT 'pending',
    `request_id`   VARCHAR(64)  NULL,               -- retry-safe client key
    `created_at`   BIGINT       NOT NULL,
    `decided_at`   BIGINT       NULL,
    `decided_by`   INT UNSIGNED NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `payments_request` (`user_id`, `request_id`),
    KEY `payments_status` (`status`, `id`),
    KEY `payments_user` (`user_id`),
    CONSTRAINT `payments_user_fk` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `payments_amount_positive` CHECK (`amount_cents` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Purchases — one row per item bought from the catalogue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchases` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`     INT UNSIGNED NOT NULL,
    `goods_id`    VARCHAR(16)  NOT NULL,
    `title`       VARCHAR(190) NOT NULL,
    `price_cents` BIGINT       NOT NULL,
    `created_at`  BIGINT       NOT NULL,
    PRIMARY KEY (`id`),
    KEY `purchases_user` (`user_id`, `id`),
    CONSTRAINT `purchases_user_fk` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `purchases_price_positive` CHECK (`price_cents` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Expensive products — legitimate digital products catalogue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `expensive_products` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `title`        VARCHAR(190) NOT NULL,
    `creator`      VARCHAR(100) NOT NULL,
    `category`     VARCHAR(100) NOT NULL,
    `formats`      VARCHAR(255) NOT NULL,
    `license`      VARCHAR(190) NOT NULL,
    `refund_period` VARCHAR(64) NOT NULL,
    `country_code` CHAR(2) NULL,
    `price_cents`  BIGINT NOT NULL,
    `blurb`        TEXT NOT NULL,
    `created_at`   BIGINT NOT NULL,
    `created_by`   INT UNSIGNED NULL,
    PRIMARY KEY (`id`),
    KEY `expensive_products_created` (`created_at`, `id`),
    CONSTRAINT `expensive_products_price_positive`
        CHECK (`price_cents` > 0),
    CONSTRAINT `expensive_products_admin_fk`
        FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Audit trail — who did what, kept for 180 days
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit` (
    `id`       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `at`       BIGINT      NOT NULL,
    `actor_id` INT UNSIGNED NULL,
    `actor`    VARCHAR(64) NULL,
    `action`   VARCHAR(64) NOT NULL,
    `target`   VARCHAR(64) NULL,
    `detail`   VARCHAR(255) NULL,
    `ip`       VARCHAR(64) NULL,
    PRIMARY KEY (`id`),
    KEY `audit_at` (`at`),
    KEY `audit_action` (`action`, `at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Postcode lookups — cache for the search page's ZIP verification
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `postcodes` (
    `country`    VARCHAR(2)   NOT NULL,
    `code`       VARCHAR(16)  NOT NULL,
    `found`      TINYINT(1)   NOT NULL,
    `place`      VARCHAR(120) NULL,
    `formatted`  VARCHAR(120) NULL,
    `checked_at` BIGINT       NOT NULL,
    PRIMARY KEY (`country`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- Password resets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `password_resets` (
    `token_hash` CHAR(64)     NOT NULL,
    `user_id`    INT UNSIGNED NOT NULL,
    `expires_at` BIGINT       NOT NULL,
    `created_at` BIGINT       NOT NULL,
    `used_at`    BIGINT       NULL,
    PRIMARY KEY (`token_hash`),
    KEY `password_resets_user` (`user_id`),
    CONSTRAINT `password_resets_user_fk` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Optional: a first admin account, so you can log into admin.html before the
-- server has created one. Delete this block if you prefer NL_ADMIN_PASSWORD.
--
--   password_hash is produced by server/app.py's hash_password(); the line
--   below is "Admin!2345" — change the password from Settings after logging in.
-- ---------------------------------------------------------------------------
-- INSERT INTO `users` (`username`, `email`, `password_hash`, `created_at`, `role`, `balance_cents`)
-- VALUES ('admin', 'admin@northlight.test',
--         'scrypt$16384$8$1$PLACEHOLDER$PLACEHOLDER', UNIX_TIMESTAMP(), 'admin', 0);

-- ---------------------------------------------------------------------------
-- Sanity check: every table above should be listed.
-- ---------------------------------------------------------------------------
SHOW TABLES;
