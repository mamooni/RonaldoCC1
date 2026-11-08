#!/usr/bin/env python3
"""
Northlight server
=======================

A small, dependency-free HTTP server that does two things:

  1. serves the storefront files (index.html, signup.html, login.html, ...)
  2. exposes a JSON API for account creation and sign-in

Run it from anywhere:

    python3 server/app.py             # http://localhost:8000
    PORT=3000 python3 server/app.py   # different port

Everything is Python standard library + SQLite, so there is nothing to install.

API
---
    POST /api/signup   {username, email, password}  -> 201 {user}
    POST /api/login    {username, password}         -> 200 {user}
    POST /api/logout                                 -> 204
    GET  /api/me                                     -> 200 {user} | 401
    GET  /api/payments                               -> 200 {payments} (own deposits)
    POST /api/account/email    {email}               -> 200 {user}
    POST /api/account/password {current, password}   -> 200 {ok}
    POST /api/payments         {amount, asset}       -> 201 {payment}   (pending)
    GET  /api/admin/data                             -> 200 {stats, users, payments}
    POST /api/admin/payment    {id, status}          -> 200 {ok}        (admin only)
    GET  /api/postcode?code=&country=                -> 200 {postcode, place, verified}
                                                        | 404, cached in SQLite

Sessions are opaque random tokens stored (hashed) in SQLite and sent to the
browser in an HttpOnly, SameSite=Lax cookie. Passwords are hashed with
scrypt and a per-user salt — never stored in the clear.

What is deliberately simple, because this is a learning/demo project:

  * single-process, threaded server; SQLite in WAL mode
  * in-memory rate limiting (resets when the process restarts)
  * no email verification, password reset or account lockout
  * the cookie is not marked Secure, so it also works over plain http on
    localhost. Put this behind HTTPS in production and add "Secure".
"""

import base64
import contextlib
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import time
import urllib.request
import urllib.parse
import urllib.error
import threading
import traceback
from decimal import Decimal, InvalidOperation
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

HERE = Path(__file__).resolve().parent
WEB_ROOT = HERE.parent  # the template folder that holds the .html files
DATA_DIR = HERE / "data"

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))

# NL_DB lets a test run (or a second instance) use its own database file.
DB_PATH = Path(os.environ.get("NL_DB") or (DATA_DIR / "northlight.db"))

# Which engine holds the data.
#   NL_DB_KIND=sqlite   (default) the file above — nothing to install
#   NL_DB_KIND=mysql    a MySQL / MariaDB server, e.g. XAMPP on your laptop:
#                       NL_MYSQL_HOST=127.0.0.1  NL_MYSQL_PORT=3306
#                       NL_MYSQL_USER=root       NL_MYSQL_PASSWORD=
#                       NL_MYSQL_DATABASE=northlight
#                       Import database/northlight.sql once (phpMyAdmin).
DB_KIND = (os.environ.get("NL_DB_KIND") or "sqlite").strip().lower()
if DB_KIND not in ("sqlite", "mysql"):
    raise SystemExit(f"NL_DB_KIND must be sqlite or mysql, not {DB_KIND!r}")

MYSQL = {
    "host": os.environ.get("NL_MYSQL_HOST", "127.0.0.1"),
    "port": int(os.environ.get("NL_MYSQL_PORT", "3306")),
    "user": os.environ.get("NL_MYSQL_USER", "root"),
    "password": os.environ.get("NL_MYSQL_PASSWORD", ""),
    "database": os.environ.get("NL_MYSQL_DATABASE", "northlight"),
    "charset": "utf8mb4",
}

SESSION_COOKIE = "nl_session"
SESSION_TTL = 60 * 60 * 24 * 30  # 30 days

RESET_TTL = 60 * 60  # reset links expire after one hour

# Optional production integrations. Keep secrets in the environment, never in
# HTML or source control. NL_TURNSTILE_SITE_KEY is safe to expose to browsers;
# NL_TURNSTILE_SECRET and SMTP credentials are not.
TURNSTILE_SITE_KEY = os.environ.get("NL_TURNSTILE_SITE_KEY", "").strip()
TURNSTILE_SECRET = os.environ.get("NL_TURNSTILE_SECRET", "").strip()
SMTP_HOST = os.environ.get("NL_SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("NL_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("NL_SMTP_USER", "").strip()
SMTP_PASSWORD = os.environ.get("NL_SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("NL_SMTP_FROM", "").strip()
RESEND_API_KEY = os.environ.get("NL_RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("NL_RESEND_FROM", "").strip()
PUBLIC_BASE_URL = os.environ.get("NL_PUBLIC_BASE_URL", "").rstrip("/")

MAX_BODY = 8 * 1024       # 8 KB is plenty for these forms
MAX_DRAIN = 256 * 1024    # anything larger gets the connection closed

# Behind HTTPS (or a TLS terminator) set NL_HTTPS=1 so the session cookie
# carries "Secure" and the server advertises HSTS.
HTTPS_ONLY = os.environ.get("NL_HTTPS", "") not in ("", "0", "false", "no")
# Frame protection is off by default because the preview panel embeds these
# pages in an iframe; turn it on for a real deployment.
STRICT_HEADERS = os.environ.get("NL_STRICT_HEADERS", "") not in ("", "0", "false", "no")

# Refuse to boot with the built-in admin password unless explicitly allowed.
ALLOW_DEFAULT_ADMIN = os.environ.get("NL_ALLOW_DEFAULT_ADMIN", "") not in (
    "",
    "0",
    "false",
    "no",
)
DEFAULT_ADMIN_PASSWORD = "Admin!2345"

# Requests that change state must come from this host (or from no origin at
# all, which is what a script or curl sends).
CHECK_ORIGIN = os.environ.get("NL_CHECK_ORIGIN", "1") not in ("0", "false", "no")

REQUEST_TIMEOUT = 15  # seconds a single connection may sit idle
MAX_THREADS = 64      # concurrent connections

# Pages that require a signed-in account. Requests for these are redirected to
# the login page by the server itself, so the store is never sent to a guest.
GATED_PAGES = {
    "index.html",
    "deposit.html",
    "messages.html",
    "search.html",
    "cart.html",
    "tickets.html",
    "settings.html",
    "activity.html",
    "support.html",
    "preview.html",
    "deposit-preview.html",
    "messages-preview.html",
    "search-preview.html",
}
LOGIN_PATH = "/login.html"
SIGNUP_PATH = "/signup.html"

# Files that must never be served as static content
# Pages that require the admin role, not merely a session.
ADMIN_PAGES = {"admin.html"}

BLOCKED_PREFIXES = ("server/", "server\\", ".git/", ".arena/")
BLOCKED_SUFFIXES = (
    ".db", ".db-wal", ".db-shm", ".db-journal", ".sqlite", ".sql",
    ".py", ".pyc", ".pyo", ".sh", ".bat", ".key", ".pem", ".env",
    ".log", ".bak", ".orig", ".rej", ".zip", ".tar", ".gz",
)
BLOCKED_NAMES = (".gitignore", ".gitattributes", ".env", ".env.example", "geoapify.key")

USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{3,32}$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")

MIN_PASSWORD = 8

# every new account starts empty: money only arrives through a confirmed deposit
NEW_USER_CENTS = 0

# --- Geoapify postcode lookups -------------------------------------------
# The key never reaches the browser: the page calls /api/postcode and this
# process talks to Geoapify. Set GEOAPIFY_KEY in the environment, or drop the
# key in server/geoapify.key (one line, nothing else).
GEOAPIFY_KEY_FILE = Path(__file__).resolve().parent / "geoapify.key"
GEOAPIFY_URL = "https://api.geoapify.com/v1/geocode/search"
POSTCODE_TIMEOUT = 8
POSTCODE_TTL = 60 * 60 * 24 * 30       # cache hits/misses for a month
POSTCODE_LIMIT = 30                     # lookups per IP per minute


def geoapify_key() -> str:
    key = os.environ.get("GEOAPIFY_KEY", "").strip()
    if key:
        return key
    if GEOAPIFY_KEY_FILE.exists():
        return GEOAPIFY_KEY_FILE.read_text(encoding="utf-8").strip()
    return ""


def look_up_postcode(country: str, code: str):
    """Ask Geoapify for one postcode. Returns dict or None when not found."""
    key = geoapify_key()
    if not key:
        return None

    query = urllib.parse.urlencode(
        {
            "text": code,
            "filter": "countrycode:" + country.lower(),
            "type": "postcode",
            "limit": 1,
            "apiKey": key,
        }
    )
    request = urllib.request.Request(
        GEOAPIFY_URL + "?" + query, headers={"Accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=POSTCODE_TIMEOUT) as response:
            payload = json.load(response)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError) as error:
        print("  postcode lookup failed:", error)
        return None

    features = payload.get("features") or []
    if not features:
        return None

    props = features[0].get("properties", {})
    city = (props.get("city") or props.get("suburb") or props.get("county") or "").strip()
    state = (props.get("state") or "").strip()
    return {
        "postcode": (props.get("postcode") or code).strip(),
        "place": ", ".join(part for part in (city, state) if part),
        "formatted": props.get("formatted", ""),
    }

# --------------------------------------------------------------------------
# Database
# --------------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',
    -- money is kept in whole cents: no float drift, ever
    balance_cents INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

-- postcode lookups are cached so a repeated check costs no API credit
CREATE TABLE IF NOT EXISTS postcodes (
    country    TEXT NOT NULL,
    code       TEXT NOT NULL,
    found      INTEGER NOT NULL,
    place      TEXT,
    formatted  TEXT,
    checked_at INTEGER NOT NULL,
    PRIMARY KEY (country, code)
);
"""

# --------------------------------------------------------------------------
# MySQL: a sqlite3-shaped façade so the rest of this file does not care
# --------------------------------------------------------------------------
#
# Every query in the app is written with "?" placeholders and dictionaries for
# rows, which is what sqlite3 gives us. PyMySQL can be wrapped in three small
# translations (placeholders, rows, a handful of SQLite-only statements) and
# then the same code runs on MySQL / MariaDB — including XAMPP's MariaDB.


class _EmptyCursor:
    """What a no-op statement (a PRAGMA) returns."""

    lastrowid = None
    rowcount = 0

    def fetchone(self):
        return None

    def fetchall(self):
        return []

    def __iter__(self):
        return iter(())


class _Cursor:
    def __init__(self, cursor):
        self._c = cursor

    @property
    def lastrowid(self):
        return self._c.lastrowid

    @property
    def rowcount(self):
        return self._c.rowcount

    def fetchone(self):
        return self._c.fetchone()

    def fetchall(self):
        return self._c.fetchall()

    def __iter__(self):
        return iter(self._c.fetchall())


_INSERT_OR_IGNORE = re.compile(r"\bINSERT\s+OR\s+IGNORE\b", re.IGNORECASE)
_UPSERT = re.compile(
    r"ON\s+CONFLICT\s*\([^)]*\)\s*DO\s+UPDATE\s+SET\s+(.+?)\s*$",
    re.IGNORECASE | re.DOTALL,
)


def _to_mysql(sql):
    """Translate one SQLite statement into MySQL. None means 'skip me'."""
    text = sql.strip().rstrip(";")
    upper = text.upper()

    # PRAGMA is SQLite bookkeeping: nothing to do on a server that has
    # transactions and foreign keys switched on by the table definitions.
    if upper.startswith("PRAGMA"):
        return None

    text = text.replace("BEGIN IMMEDIATE", "START TRANSACTION")
    text = _INSERT_OR_IGNORE.sub("INSERT IGNORE", text)

    upsert = _UPSERT.search(text)
    if upsert:
        assignments = re.sub(r"excluded\.(\w+)", r"VALUES(\1)", upsert.group(1))
        text = text[: upsert.start()] + "ON DUPLICATE KEY UPDATE " + assignments

    return text


class _MySQLConn:
    """A sqlite3 connection look-alike over PyMySQL."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=()):
        text = _to_mysql(sql)
        if text is None:
            return _EmptyCursor()
        cursor = self._conn.cursor()
        if params:
            # % is the placeholder marker in PyMySQL's own formatting
            cursor.execute(text.replace("%", "%%").replace("?", "%s"), tuple(params))
        else:
            cursor.execute(text)
        return _Cursor(cursor)

    def executescript(self, script):
        for statement in script.split(";"):
            if statement.strip():
                self.execute(statement)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


def _mysql_connect():
    try:
        import pymysql
        import pymysql.cursors
    except ImportError:  # pragma: no cover - configuration problem, not a bug
        raise SystemExit(
            "NL_DB_KIND=mysql needs PyMySQL. Install it with:\n"
            "    python3 -m pip install pymysql"
        )
    conn = pymysql.connect(
        **MYSQL,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
        connect_timeout=10,
        read_timeout=30,
        write_timeout=30,
    )
    return _MySQLConn(conn)


@contextlib.contextmanager
def _mysql_db(write=False):
    conn = _mysql_connect()
    try:
        if write:
            conn.execute("START TRANSACTION")
        yield conn
        if write:
            conn.commit()
    except BaseException:
        if write:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        conn.close()


@contextlib.contextmanager
def db(write=False):
    """One short-lived connection per request.

    A writer opens its transaction with BEGIN IMMEDIATE, so two requests can
    never interleave a read-then-write on the same row — SQLite serialises the
    writers instead of us guessing with a process-wide lock. Readers in WAL
    mode do not block anybody.
    """
    if DB_KIND == "mysql":
        with _mysql_db(write) as conn:
            yield conn
        return

    conn = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=10000")
    try:
        if write:
            conn.execute("BEGIN IMMEDIATE")
        yield conn
        if write:
            conn.execute("COMMIT")
    except BaseException:
        if write:
            try:
                conn.execute("ROLLBACK")
            except sqlite3.Error:
                pass
        raise
    finally:
        conn.close()


ADMIN_USERNAME = os.environ.get("NL_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("NL_ADMIN_PASSWORD", "Admin!2345")

PAYMENTS_TABLE = """
CREATE TABLE IF NOT EXISTS payments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    asset        TEXT    NOT NULL DEFAULT 'USDT',
    network      TEXT    NOT NULL DEFAULT 'TRC-20',
    status       TEXT    NOT NULL DEFAULT 'pending',   -- pending | confirmed | failed
    request_id   TEXT,                                 -- client key: makes retries safe
    created_at   INTEGER NOT NULL,
    decided_at   INTEGER,
    decided_by   INTEGER,
    CHECK (status IN ('pending', 'confirmed', 'failed')),
    CHECK (amount_cents > 0)
);
CREATE INDEX IF NOT EXISTS payments_status ON payments(status, id);
CREATE INDEX IF NOT EXISTS payments_user ON payments(user_id);
-- one row per client request, so a re-sent request returns the same payment
CREATE UNIQUE INDEX IF NOT EXISTS payments_request
    ON payments(user_id, request_id) WHERE request_id IS NOT NULL;
"""

PURCHASES_TABLE = """
CREATE TABLE IF NOT EXISTS purchases (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goods_id    TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    price_cents INTEGER NOT NULL,
    created_at  INTEGER NOT NULL,
    CHECK (price_cents > 0)
);
CREATE INDEX IF NOT EXISTS purchases_user ON purchases(user_id, id);
"""

# Every privileged or money-moving action lands here, so a deposit can always
# be traced back to the request that created it and the admin who decided it.
AUDIT_TABLE = """
CREATE TABLE IF NOT EXISTS audit (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    at       INTEGER NOT NULL,
    actor_id INTEGER,
    actor    TEXT,
    action   TEXT NOT NULL,
    target   TEXT,
    detail   TEXT,
    ip       TEXT
);
CREATE INDEX IF NOT EXISTS audit_at ON audit(at);
CREATE INDEX IF NOT EXISTS audit_action ON audit(action, at);
"""


def _table_columns(conn, table: str):
    if DB_KIND == "mysql":
        return {
            row["COLUMN_NAME"] if "COLUMN_NAME" in row else row["column_name"]
            for row in conn.execute(
                "SELECT column_name AS COLUMN_NAME FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND table_name = ?",
                (table,),
            ).fetchall()
        }
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}


def _has_table(conn, name: str) -> bool:
    if DB_KIND == "mysql":
        return (
            conn.execute(
                "SELECT 1 AS hit FROM information_schema.tables "
                "WHERE table_schema = DATABASE() AND table_name = ?",
                (name,),
            ).fetchone()
            is not None
        )
    return (
        conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (name,)
        ).fetchone()
        is not None
    )


def _migrate(conn):
    """Bring an existing database up to date without losing anything.

    SQLite only: a MySQL database is created complete by
    database/northlight.sql, so there is nothing to migrate.

    Older databases stored money as REAL. They are rebuilt once with the
    amounts converted to whole cents; the ids and every row survive.
    """
    if DB_KIND != "mysql" and _has_table(conn, "payments") and "request_id" not in _table_columns(conn, "payments"):
        conn.execute("ALTER TABLE payments ADD COLUMN request_id TEXT")
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS payments_request "
            "ON payments(user_id, request_id) WHERE request_id IS NOT NULL"
        )

    cols = _table_columns(conn, "users")
    if "role" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")

    if "balance_cents" not in cols:
        if "balance" in cols:
            _rebuild(conn, "users", """
                CREATE TABLE users_new (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    password_hash TEXT NOT NULL,
                    created_at    INTEGER NOT NULL,
                    role          TEXT NOT NULL DEFAULT 'user',
                    balance_cents INTEGER NOT NULL DEFAULT 0
                )""", """
                INSERT INTO users_new
                    (id, username, email, password_hash, created_at, role, balance_cents)
                SELECT id, username, email, password_hash, created_at,
                       COALESCE(role, 'user'),
                       CAST(ROUND(COALESCE(balance, 0) * 100) AS INTEGER)
                FROM users""")
            print("  migrated users.balance -> balance_cents (money is now in cents)")
        else:
            conn.execute(
                "ALTER TABLE users ADD COLUMN balance_cents INTEGER NOT NULL DEFAULT 0"
            )

    if _has_table(conn, "payments"):
        pcols = _table_columns(conn, "payments")
        if "amount_cents" not in pcols:
            _rebuild(conn, "payments", """
                CREATE TABLE payments_new (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    amount_cents INTEGER NOT NULL,
                    asset        TEXT    NOT NULL DEFAULT 'USDT',
                    network      TEXT    NOT NULL DEFAULT 'TRC-20',
                    status       TEXT    NOT NULL DEFAULT 'pending',
                    created_at   INTEGER NOT NULL,
                    decided_at   INTEGER,
                    decided_by   INTEGER,
                    CHECK (status IN ('pending', 'confirmed', 'failed')),
                    CHECK (amount_cents > 0)
                )""", """
                INSERT INTO payments_new
                    (id, user_id, amount_cents, asset, network, status,
                     created_at, decided_at, decided_by)
                SELECT id, user_id, CAST(ROUND(amount * 100) AS INTEGER),
                       asset, network, status, created_at, decided_at, decided_by
                FROM payments""")
            print("  migrated payments.amount -> amount_cents (money is now in cents)")

    conn.executescript(PAYMENTS_TABLE)
    conn.executescript(PURCHASES_TABLE)
    conn.executescript(AUDIT_TABLE)


def _rebuild(conn, table: str, create_sql: str, copy_sql: str):
    """Swap a table for a new definition while keeping its rows and ids."""
    conn.execute("PRAGMA foreign_keys=OFF")
    try:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(create_sql)
        conn.execute(copy_sql)
        conn.execute(f"DROP TABLE {table}")
        conn.execute(f"ALTER TABLE {table}_new RENAME TO {table}")
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.execute("PRAGMA foreign_keys=ON")
    broken = conn.execute("PRAGMA foreign_key_check").fetchall()
    if broken:
        raise RuntimeError(f"migration of {table} left dangling references: {broken}")


def _seed_admin(conn):
    """Make sure one admin account exists, so the dashboard can be reached."""
    row = conn.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1").fetchone()
    if row is not None:
        return

    # someone may already have signed up with the admin username: promote them
    existing = conn.execute(
        "SELECT id FROM users WHERE username = ?", (ADMIN_USERNAME,)
    ).fetchone()
    if existing is not None:
        conn.execute("UPDATE users SET role = 'admin' WHERE id = ?", (existing["id"],))
        conn.commit()
        print(f"  promoted existing account {ADMIN_USERNAME!r} to admin")
        return

    conn.execute(
        "INSERT INTO users (username, email, password_hash, created_at, role, balance_cents) "
        "VALUES (?, ?, ?, ?, 'admin', 0)",
        (
            ADMIN_USERNAME,
            f"{ADMIN_USERNAME}@northlight.local",
            hash_password(ADMIN_PASSWORD),
            int(time.time()),
        ),
    )
    conn.commit()
    conn.execute(
        "INSERT INTO audit (at, actor, action, target, detail, ip) "
        "VALUES (?, ?, 'admin.seed', ?, ?, ?)",
        (int(time.time()), "system", ADMIN_USERNAME, "account created on first start", "-"),
    )
    conn.commit()
    print(f"  created admin account {ADMIN_USERNAME!r}")


def prune_sessions(conn):
    """Drop sessions that have expired; called on boot and after each login."""
    now = int(time.time())
    removed = conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now,)).rowcount
    conn.execute("DELETE FROM audit WHERE at < ?", (now - 180 * 24 * 3600,))
    return removed


MYSQL_TABLES = ("users", "sessions", "payments", "purchases", "audit", "postcodes")


def init_mysql():
    """Keep MySQL honest: the tables come from database/northlight.sql."""
    conn = _mysql_connect()
    try:
        missing = [t for t in MYSQL_TABLES if not _has_table(conn, t)]
        if missing:
            raise SystemExit(
                "The MySQL database is missing these tables: "
                + ", ".join(missing)
                + "\nImport database/northlight.sql into `"
                + MYSQL["database"]
                + "` (phpMyAdmin → Import) and start again."
            )
        _seed_admin(conn)
        dropped = prune_sessions(conn)
        conn.commit()
        if dropped:
            print(f"  dropped {dropped} expired session(s)")
    finally:
        conn.close()


def init_db():
    if DB_KIND == "mysql":
        return init_mysql()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.executescript(SCHEMA)
        _migrate(conn)
        _seed_admin(conn)
        dropped = prune_sessions(conn)
        conn.commit()
        if dropped:
            print(f"  dropped {dropped} expired session(s)")
    finally:
        conn.close()


# --------------------------------------------------------------------------
# Passwords and tokens
# --------------------------------------------------------------------------

SCRYPT_N = 2 ** 14
SCRYPT_R = 8
SCRYPT_P = 1


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def hash_password(password: str) -> str:
    """scrypt$n$r$p$salt$hash — self-describing, so parameters can change later."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=32,
        maxmem=64 * 1024 * 1024,
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, hash_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(
            password.encode("utf-8"),
            salt=base64.b64decode(salt_b64),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=32,
            maxmem=64 * 1024 * 1024,
        )
        return hmac.compare_digest(digest, base64.b64decode(hash_b64))
    except (ValueError, TypeError):
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_session(conn, user_id: int, ttl: int = SESSION_TTL, keep: int = 10):
    """Create a session. Only the newest `keep` sessions per account survive."""
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) "
        "VALUES (?, ?, ?, ?)",
        (token_hash(token), user_id, now + ttl, now),
    )
    # the derived table keeps MariaDB/MySQL happy (LIMIT is not allowed
    # directly inside IN (...)) and behaves the same on SQLite
    conn.execute(
        "DELETE FROM sessions WHERE user_id = ? AND token_hash NOT IN ("
        "  SELECT token_hash FROM ("
        "    SELECT token_hash FROM sessions WHERE user_id = ? "
        "    ORDER BY created_at DESC, token_hash DESC LIMIT ?"
        "  ) AS newest)",
        (user_id, user_id, keep),
    )
    return token


_DUMMY_HASH = None


def dummy_hash() -> str:
    """A valid hash of a value nobody knows, built once, for timing parity."""
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        _DUMMY_HASH = hash_password(secrets.token_urlsafe(24))
    return _DUMMY_HASH


def user_for_token(conn, token: str):
    if not token:
        return None
    row = conn.execute(
        "SELECT u.id, u.username, u.email, u.created_at, u.role, u.balance_cents, "
        "s.expires_at "
        "FROM sessions s JOIN users u ON u.id = s.user_id "
        "WHERE s.token_hash = ?",
        (token_hash(token),),
    ).fetchone()

    if row is None:
        return None
    if row["expires_at"] < int(time.time()):
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),))
        conn.commit()
        return None

    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "created_at": row["created_at"],
        "role": row["role"],
        "balance": dollars(row["balance_cents"]),
    }


# --------------------------------------------------------------------------
# Goods catalogue — the till reads the same list the page does
# --------------------------------------------------------------------------

# search.js numbers its rows 412345, 416345, 420345 ... so the shop and the
# server agree on what "id 412345" costs without a second copy of the price list.
def _goods_source():
    """Where the catalogue lives — assets/js/ now, the root in older copies."""
    for rel in ("assets/js/search.js", "search.js"):
        candidate = WEB_ROOT / rel
        if candidate.is_file():
            return candidate
    return WEB_ROOT / "assets" / "js" / "search.js"


def _drops_source():
    """The drops feed the table now, so the catalogue lives here when it exists."""
    for rel in ("assets/data/drops-data.js", "drops-data.js"):
        candidate = WEB_ROOT / rel
        if candidate.is_file():
            return candidate
    return WEB_ROOT / "assets" / "data" / "drops-data.js"


def _bundles_source():
    """The Bundles page feed: same JSON-in-JS convention as the drops."""
    for rel in ("assets/data/bundles-data.js", "bundles-data.js"):
        candidate = WEB_ROOT / rel
        if candidate.is_file():
            return candidate
    return WEB_ROOT / "assets" / "data" / "bundles-data.js"


GOODS_JS = _goods_source()  # re-resolved on every read, so moving the file is fine
DROPS_JS = _drops_source()
BUNDLES_JS = _bundles_source()
# Catalogue ids: six digits, a mix of leading blocks. Must stay identical to
# goodsIds() in search.js — same prefixes, same arithmetic, same order.
ID_PREFIXES = ("4", "51", "34", "60")


def catalogue_ids(count):
    """['4...', '51..', '34..', '60..', ...] in catalogue order."""
    ids = []
    seen = set()
    for index in range(count):
        prefix = ID_PREFIXES[index % len(ID_PREFIXES)]
        width = 6 - len(prefix)
        space = 10 ** width
        h = ((index + 1) * 2654435761) % 2147483647
        while True:
            h = (h * 48271) % 2147483647
            candidate = prefix + str(h % space).rjust(width, "0")
            if candidate not in seen:
                break
        seen.add(candidate)
        ids.append(candidate)
    return ids


def _drops_rows(path):
    """[[title, creator, None, None, price], ...] out of window.NL_DROPS.

    The array in drops-data.js is strict JSON, so this is a plain JSON read —
    no JS parsing, no eval.
    """
    try:
        source = path.read_text(encoding="utf-8")
        start = source.index("[", source.index("window.NL_DROPS"))
        end = source.rindex("]")
        drops = json.loads(source[start : end + 1])
    except (OSError, ValueError):
        return []

    rows = []
    for drop in drops:
        if not isinstance(drop, dict):
            continue
        title = drop.get("title")
        price = drop.get("price")
        if not title or price is None:
            continue
        # same five-slot shape as a RAW row, so one consumer handles both
        rows.append([str(title), str(drop.get("creator", "")), None, None, price])
    return rows


def bundle_rows(path=None):
    """[[name, "Bundles", None, None, price], ...] from window.NL_BUNDLES.

    Same five-slot shape as a drop row, so goods_catalogue() treats a bundle
    exactly like any other listing: the price comes from this file, never from
    the browser.
    """
    source_path = path or _bundles_source()
    try:
        source = source_path.read_text(encoding="utf-8")
        start = source.index("[", source.index("window.NL_BUNDLES"))
        end = source.rindex("]")
        bundles = json.loads(source[start : end + 1])
    except (OSError, ValueError):
        return []

    rows = []
    for bundle in bundles:
        if not isinstance(bundle, dict):
            continue
        name = bundle.get("name")
        price = bundle.get("price")
        if not name or price is None:
            continue
        rows.append([str(name), "Bundles", None, None, price])
    return rows


def _raw_rows(path):
    """[[title, creator, category, format, price, ...], ...] from search.js."""
    try:
        source = path.read_text(encoding="utf-8")
        start = source.index("var RAW = [")
        end = source.index("\n  ];", start)
    except (OSError, ValueError):
        return []

    rows = []
    for line in source[start:end].splitlines():
        line = line.strip()
        if not line.startswith("["):
            continue
        try:
            rows.append(json.loads(line.rstrip(",")))
        except ValueError:
            continue
    return rows


def catalogue_rows():
    """Every listing the shop sells, whatever file it comes from."""
    global DROPS_JS
    DROPS_JS = _drops_source()
    rows = _drops_rows(DROPS_JS)
    if rows:
        return rows
    return _raw_rows(GOODS_JS)

_goods_lock = threading.Lock()
_goods_cache = {"mtime": None, "items": {}}


def goods_catalogue():
    """{id: {id, title, creator, price_cents}} read from search.js.

    Cached until the file changes, so editing the catalogue is enough to change
    what the shop sells — no restart, no duplicated price list.
    """
    global GOODS_JS, BUNDLES_JS
    GOODS_JS = _goods_source()  # the file may have been moved since boot
    BUNDLES_JS = _bundles_source()

    try:
        mtime = (GOODS_JS.stat().st_mtime, BUNDLES_JS.stat().st_mtime)
    except OSError:
        return {}

    with _goods_lock:
        if _goods_cache["mtime"] == mtime:
            return _goods_cache["items"]

    # Drops first, then bundles: the drop ids stay exactly as they were, and the
    # bundles simply continue the same sequence (so no id can ever collide).
    rows = catalogue_rows() + bundle_rows(BUNDLES_JS)
    if not rows:
        return {}

    items = {}
    ids = catalogue_ids(len(rows))
    for index, row in enumerate(rows):
        if len(row) < 5 or isinstance(row[4], bool):
            continue
        try:
            price_cents = int(round(float(row[4]) * 100))
        except (TypeError, ValueError):
            continue
        if price_cents <= 0:
            continue
        goods_id = ids[index]
        items[goods_id] = {
            "id": goods_id,
            "title": str(row[0]),
            "creator": str(row[1]),
            "price_cents": price_cents,
        }

    with _goods_lock:
        _goods_cache["mtime"] = mtime
        _goods_cache["items"] = items
    return items


# --------------------------------------------------------------------------
# Money — always integer cents inside, always dollars on the wire
# --------------------------------------------------------------------------

def dollars(cents) -> float:
    """Cents -> the JSON number the pages already expect ($74.00 -> 74.0)."""
    return round(float(cents or 0) / 100.0, 2)


def parse_cents(raw, low=0, high=0):
    """Strictly parse a user-supplied amount.

    Returns (cents, error). Rejects NaN/Infinity (which `float()` happily
    accepts and which can slip past range checks, because every comparison
    against NaN is False), anything with more than two decimals, and amounts
    outside [low, high].
    """
    if isinstance(raw, bool) or raw is None:
        return None, "Enter an amount."
    if isinstance(raw, float) and (raw != raw or raw in (float("inf"), float("-inf"))):
        return None, "Enter a real amount."
    text = str(raw).strip().replace(",", "")
    if text.startswith("$"):
        text = text[1:].strip()
    if not text:
        return None, "Enter an amount."
    try:
        value = Decimal(text)
    except (InvalidOperation, ValueError):
        return None, "Enter an amount."
    if not value.is_finite():
        return None, "Enter a real amount."
    if value != value.quantize(Decimal("0.01")):
        return None, "Use at most two decimal places."
    cents = int(value * 100)
    if low is not None and cents < low:
        return None, "That is below the minimum."
    if high is not None and cents > high:
        return None, "That is above the maximum."
    return cents, None


def audit(conn, action, actor=None, target=None, detail=None, ip=None):
    """Write one audit row. Never raises: logging must not break a request."""
    try:
        conn.execute(
            "INSERT INTO audit (at, actor_id, actor, action, target, detail, ip) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                int(time.time()),
                (actor or {}).get("id"),
                (actor or {}).get("username"),
                action,
                None if target is None else str(target),
                None if detail is None else str(detail)[:500],
                ip,
            ),
        )
    except sqlite3.Error as error:  # pragma: no cover - defensive
        print("  audit write failed:", error)


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------


def validate_signup(payload):
    """Returns (clean_values, field_errors)."""
    errors = {}

    username = str(payload.get("username", "")).strip()
    email = str(payload.get("email", "")).strip()
    password = str(payload.get("password", ""))

    if not username:
        errors["username"] = "Choose a username."
    elif not USERNAME_RE.match(username):
        errors["username"] = (
            "3-32 characters: letters, numbers, dots, dashes or underscores."
        )

    if not email:
        errors["email"] = "Enter your email address."
    elif len(email) > 254 or not EMAIL_RE.match(email):
        errors["email"] = "That email address looks off."

    if len(password) < MIN_PASSWORD:
        errors["password"] = f"Use at least {MIN_PASSWORD} characters."
    elif not re.search(r"[A-Za-z]", password):
        errors["password"] = "Add at least one letter."
    elif not re.search(r"\d", password):
        errors["password"] = "Add at least one number."
    elif not re.search(r"[^A-Za-z0-9]", password):
        errors["password"] = "Add at least one symbol."

    return {"username": username, "email": email, "password": password}, errors


# --------------------------------------------------------------------------
# Rate limiting (in memory, per IP)
# --------------------------------------------------------------------------

ATTEMPT_LIMIT = int(os.environ.get("NL_LOGIN_LIMIT", "12"))
ATTEMPT_WINDOW = 60  # seconds


def _limit(name, default):
    """Rate limits can be tuned (or relaxed for a load test) from the env."""
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default

class SlidingWindow:
    """N hits per window, per key. Thread-safe, self-pruning."""

    def __init__(self, limit, window, name=""):
        self.limit = limit
        self.window = window
        self.name = name
        self._hits = {}
        self._lock = threading.Lock()

    def hit(self, key) -> bool:
        """Record one hit. True means the caller is now over the limit."""
        if self.limit is None:
            return False
        now = time.time()
        with self._lock:
            hits = [t for t in self._hits.get(key, ()) if now - t < self.window]
            hits.append(now)
            self._hits[key] = hits
            if len(self._hits) > 2048:
                for dead in [
                    k for k, v in self._hits.items() if not v or now - v[-1] > self.window * 4
                ]:
                    self._hits.pop(dead, None)
            return len(hits) > self.limit

    def reset(self, key):
        with self._lock:
            self._hits.pop(key, None)


class Lockbox:
    """Failed-password counter that locks an account for a growing period.

    The IP limiter stops one host from hammering; this stops the same account
    being sprayed from many hosts. Five wrong passwords lock the account for a
    minute, ten for two, twenty for four — capped at an hour.
    """

    THRESHOLD = 5
    BASE = 60
    CAP = 3600
    FORGET_AFTER = 3600

    def __init__(self):
        self._entries = {}
        self._lock = threading.Lock()

    def locked_for(self, key: str) -> int:
        now = time.time()
        with self._lock:
            entry = self._entries.get(key)
            if not entry:
                return 0
            return max(0, int(entry["until"] - now) + 1) if entry["until"] > now else 0

    def fail(self, key: str) -> None:
        now = time.time()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None or now - entry["last"] > self.FORGET_AFTER:
                entry = {"count": 0, "strikes": 0, "until": 0.0, "last": now}
            entry["count"] += 1
            entry["last"] = now
            if entry["count"] % self.THRESHOLD == 0:
                entry["strikes"] += 1
                entry["until"] = now + min(self.BASE * (2 ** (entry["strikes"] - 1)), self.CAP)
            self._entries[key] = entry
            if len(self._entries) > 4096:
                for dead in [
                    k for k, v in self._entries.items() if now - v["last"] > self.FORGET_AFTER
                ]:
                    self._entries.pop(dead, None)

    def forgive(self, key: str) -> None:
        with self._lock:
            self._entries.pop(key, None)


# One limiter per kind of pressure, so a busy deposit page cannot lock people
# out of signing in.
login_throttle = SlidingWindow(_limit("NL_LOGIN_LIMIT", ATTEMPT_LIMIT), ATTEMPT_WINDOW, "login")
signup_throttle = SlidingWindow(_limit("NL_SIGNUP_LIMIT", 6), 300, "signup")
account_throttle = SlidingWindow(_limit("NL_ACCOUNT_LIMIT", 30), 300, "account")
payment_throttle = SlidingWindow(_limit("NL_PAYMENT_LIMIT", 60), 300, "payments")
purchase_throttle = SlidingWindow(_limit("NL_PURCHASE_LIMIT", 20), 60, "purchase")
admin_throttle = SlidingWindow(_limit("NL_ADMIN_LIMIT", 120), 60, "admin")
postcode_throttle = SlidingWindow(POSTCODE_LIMIT, 60, "postcode")
login_failures = Lockbox()


def too_many_lookups(ip: str) -> bool:
    return postcode_throttle.hit(ip)


# --------------------------------------------------------------------------
# HTTP handler
# --------------------------------------------------------------------------

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
}


BASE_CSP = (
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
    "script-src 'self'; connect-src 'self'; font-src 'self' data:; "
    "object-src 'none'; base-uri 'none'; form-action 'self'"
)
# the standalone preview files carry a small inline script of their own
PREVIEW_CSP = BASE_CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")

POST_ROUTES = {
    "/api/signup": "api_signup",
    "/api/login": "api_login",
    "/api/logout": "api_logout",
    "/api/account/email": "api_account_email",
    "/api/account/password": "api_account_password",
    "/api/payments": "api_create_payment",
    "/api/purchase": "api_purchase",
    "/api/admin/payment": "api_admin_payment",
}

GET_ROUTES = ("/api/me", "/api/orders", "/api/payments", "/api/admin/data", "/api/postcode", "/api/bundles")

page_throttle = SlidingWindow(_limit("NL_PAGE_LIMIT", 300), 60, "pages")  # per IP
post_throttle = SlidingWindow(_limit("NL_POST_LIMIT", 60), 60, "posts")    # per IP


def _no_constants(value):  # pragma: no cover - raised into json.loads
    raise ValueError(f"{value} is not a number")


class Handler(BaseHTTPRequestHandler):
    # Do not advertise the interpreter version in the Server header.
    server_version = "Northlight/2.0"
    sys_version = ""
    protocol_version = "HTTP/1.1"
    timeout = REQUEST_TIMEOUT

    def version_string(self):
        return self.server_version

    # ---------------- plumbing ----------------

    def log_message(self, fmt, *args):  # quieter, single-line access log
        print(f"  {self.address_string()} {fmt % args}")

    def log_error(self, fmt, *args):
        print(f"  ! {self.address_string()} {fmt % args}")

    def _base_headers(self, csp=None):
        policy = csp or BASE_CSP
        headers = [
            ("X-Content-Type-Options", "nosniff"),
            ("Referrer-Policy", "no-referrer"),
            ("X-Permitted-Cross-Domain-Policies", "none"),
            ("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()"),
        ]
        if STRICT_HEADERS:
            # off by default: the preview panel embeds these pages in an iframe
            policy += "; frame-ancestors 'none'"
            headers += [
                ("X-Frame-Options", "DENY"),
                ("Cross-Origin-Opener-Policy", "same-origin"),
            ]
        headers.append(("Content-Security-Policy", policy))
        if HTTPS_ONLY:
            headers.append(
                ("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
            )
        return headers

    def _send(self, status, body=b"", content_type=None, extra_headers=None, csp=None):
        self.send_response(status)
        if content_type:
            self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for key, value in self._base_headers(csp):
            self.send_header(key, value)
        for key, value in (extra_headers or []):
            self.send_header(key, value)
        self.end_headers()
        self._responded = True
        if body and self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status, payload, extra_headers=None):
        body = json.dumps(payload).encode("utf-8")
        self._send(
            status,
            body,
            "application/json; charset=utf-8",
            [("Cache-Control", "no-store")] + (extra_headers or []),
        )

    def _error(self, status, message, **extra):
        payload = {"error": message}
        payload.update(extra)
        self._json(status, payload)

    def _redirect(self, location, extra_headers=None):
        self.send_response(302)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        for key, value in self._base_headers():
            self.send_header(key, value)
        for key, value in (extra_headers or []):
            self.send_header(key, value)
        self.end_headers()
        self._responded = True

    def _cookie_token(self):
        raw = self.headers.get("Cookie", "")
        for chunk in raw.split(";"):
            name, _, value = chunk.strip().partition("=")
            if name == SESSION_COOKIE:
                return value
        return ""

    def _session_cookie(self, token, max_age=SESSION_TTL):
        # max_age=None -> no Max-Age, so the cookie dies with the browser
        # session ("remember me" switched off)
        attrs = f"{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax"
        if max_age is not None:
            attrs += f"; Max-Age={max_age}"
        if HTTPS_ONLY:
            attrs += "; Secure"
        return ("Set-Cookie", attrs)

    def _clear_cookie(self):
        attrs = f"{SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
        if HTTPS_ONLY:
            attrs += "; Secure"
        return ("Set-Cookie", attrs)

    def send_error(self, code, message=None, explain=None):
        """Malformed requests answer in the same shape as everything else,
        and a client that hung up mid-request cannot spray tracebacks."""
        try:
            text = message or explain or "Bad request."
            if (getattr(self, "path", "") or "").startswith("/api/"):
                self._error(code, text)
            else:
                self._send(code, text.encode(), "text/plain; charset=utf-8")
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception:
            self.close_connection = True

    # ---- request body: read it exactly, or hang up -----------------------

    def _read_body(self):
        """Returns (body, status). A refused body is still drained, so a
        keep-alive connection can never desync into the next request."""
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.close_connection = True
            return None, 400

        if length < 0 or length > MAX_DRAIN:
            self.close_connection = True
            return None, 413

        raw = b""
        while len(raw) < length:
            chunk = self.rfile.read(length - len(raw))
            if not chunk:
                self.close_connection = True
                return None, 400
            raw += chunk

        if length > MAX_BODY:
            return None, 413
        return raw, None

    def _read_json(self):
        raw, status = self._read_body()
        if status is not None:
            return None, status
        if not raw:
            return None, 400
        try:
            payload = json.loads(raw.decode("utf-8"), parse_constant=_no_constants)
        except (ValueError, UnicodeDecodeError):
            return None, 400
        if not isinstance(payload, dict):
            return None, 400
        return payload, None

    # ---- cheap CSRF defence ---------------------------------------------

    def _same_origin(self):
        """Reject a state-changing request that says it came from elsewhere.

        SameSite=Lax already stops other sites from sending the cookie on a
        cross-site POST; this catches the cases where that is not enough
        (a browser that ignores it, or a proxied deployment).
        """
        if not CHECK_ORIGIN:
            return True

        # Modern browsers state the relationship outright, and it stays true
        # behind a proxy that rewrites Host, so it is the primary signal.
        site = (self.headers.get("Sec-Fetch-Site") or "").lower()
        if site:
            return site in ("same-origin", "same-site", "none")

        origin = self.headers.get("Origin") or self.headers.get("Referer") or ""
        if not origin:
            return True  # curl, a script, or an old client

        # No Sec-Fetch-Site (older browser): compare against every host name we
        # were reached by, including the one a proxy forwarded.
        allowed = {
            (self.headers.get("Host") or "").lower(),
            (self.headers.get("X-Forwarded-Host") or "").lower(),
        }
        allowed.discard("")
        try:
            parsed = urllib.parse.urlsplit(origin)
        except ValueError:
            return False
        return bool(parsed.netloc) and parsed.netloc.lower() in allowed

    # ---------------- routing ----------------

    def _guard(self, work):
        """Turn an unexpected failure into a 500 instead of a dropped socket."""
        try:
            work()
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception:
            traceback.print_exc()
            self.close_connection = True
            if not getattr(self, "_responded", False):
                try:
                    self._error(500, "Something went wrong on the server.")
                except Exception:
                    pass

    def do_GET(self):
        self._guard(self._get)

    def do_HEAD(self):
        self._guard(self._get)

    def do_POST(self):
        self._guard(self._post)

    def _not_allowed(self):
        self._send(
            405,
            b"Method not allowed.",
            "text/plain; charset=utf-8",
            [("Allow", "GET, HEAD, POST")],
        )

    def do_PUT(self):
        self._not_allowed()

    def do_PATCH(self):
        self._not_allowed()

    def do_DELETE(self):
        self._not_allowed()

    def __getattr__(self, name):
        # any other method the client tries: 405 rather than a 501 traceback
        if name.startswith("do_"):
            return self._not_allowed
        raise AttributeError(name)

    def _get(self):
        path = self.path.split("?")[0]
        if page_throttle.hit(self.client_address[0]):
            return self._error(429, "Too many requests. Slow down.")

        if path == "/api/me":
            return self.api_me()
        if path == "/api/orders":
            return self.api_orders()
        if path == "/api/payments":
            return self.api_my_payments()
        if path == "/api/admin/data":
            return self.api_admin_data()
        if path == "/api/bundles":
            return self.api_bundles()
        if path.startswith("/api/postcode"):
            return self.api_postcode()
        if path.startswith("/api/"):
            return self._error(404, "Unknown endpoint.")
        if path == "/api":
            return self._error(404, "Unknown endpoint.")

        return self.serve_static(path)

    def _post(self, path=None):
        path = (path or self.path).split("?")[0]
        handler = POST_ROUTES.get(path)
        if handler is None:
            return self._error(404, "Unknown endpoint.")

        ip = self.client_address[0]
        if post_throttle.hit(ip):
            return self._error(429, "Too many requests. Slow down.")
        if not self._same_origin():
            return self._error(403, "That request came from another site.")

        if path == "/api/logout":
            return self.api_logout()

        # The password limiter only guards the endpoints that accept a
        # password: changing your email or confirming a payment must not be
        # throttled by a bot guessing credentials elsewhere.
        if path == "/api/login" and login_throttle.hit(ip):
            return self._error(429, "Too many attempts. Wait a minute and try again.")
        if path == "/api/signup" and signup_throttle.hit(ip):
            return self._error(429, "Too many sign-ups from here. Try again later.")

        payload, status = self._read_json()
        if status == 413:
            return self._error(413, "That request is too large.")
        if status is not None:
            return self._error(400, "Expected a JSON body.")

        return getattr(self, handler)(payload)

    # ---------------- API ----------------

    def _current_user(self):
        token = self._cookie_token()
        if not token:
            return None
        with db() as conn:
            return user_for_token(conn, token)

    def api_signup(self, payload):
        values, errors = validate_signup(payload)
        if errors:
            return self._json(
                400, {"error": "Please fix the highlighted fields.", "fields": errors}
            )

        # scrypt is deliberately slow: hash before opening the write transaction
        # so nobody else waits on it, and so a lock is never held for ~100 ms.
        password_hash = hash_password(values["password"])
        now = int(time.time())

        try:
            with db(write=True) as conn:
                existing = conn.execute(
                    "SELECT username, email FROM users WHERE username = ? OR email = ?",
                    (values["username"], values["email"]),
                ).fetchone()

                if existing:
                    if existing["username"].lower() == values["username"].lower():
                        errors["username"] = "That username is taken."
                    if existing["email"].lower() == values["email"].lower():
                        errors["email"] = "That email is already registered."
                    return self._json(
                        409,
                        {"error": "That account already exists.", "fields": errors},
                    )

                cursor = conn.execute(
                    "INSERT INTO users (username, email, password_hash, created_at, balance_cents) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (values["username"], values["email"], password_hash, now, NEW_USER_CENTS),
                )
                user_id = cursor.lastrowid
                token = new_session(conn, user_id)
                audit(
                    conn,
                    "account.signup",
                    actor={"id": user_id, "username": values["username"]},
                    target=values["username"],
                    detail=values["email"],
                    ip=self.client_address[0],
                )
        except sqlite3.IntegrityError:
            # two sign-ups for the same name arrived together
            return self._json(
                409,
                {
                    "error": "That account already exists.",
                    "fields": {"username": "That username is taken."},
                },
            )

        user = {
            "id": user_id,
            "username": values["username"],
            "email": values["email"],
            "created_at": now,
            "role": "user",
            "balance": dollars(NEW_USER_CENTS),
        }
        return self._json(201, {"user": user}, [self._session_cookie(token)])

    def api_login(self, payload):
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", ""))
        ip = self.client_address[0]

        if not username or not password:
            return self._json(
                400,
                {
                    "error": "Enter your username and password.",
                    "fields": {
                        **({"username": "Enter your username."} if not username else {}),
                        **({"password": "Enter your password."} if not password else {}),
                    },
                },
            )

        if len(username) > 64 or len(password) > 1024:
            return self._error(401, "Username or password is incorrect.")

        account = username.lower()
        wait = login_failures.locked_for(account)
        if wait:
            return self._json(
                429,
                {
                    "error": (
                        "Too many wrong passwords for that account. "
                        f"Try again in {wait} seconds."
                    )
                },
                [("Retry-After", str(wait))],
            )

        with db() as conn:
            row = conn.execute(
                "SELECT id, username, email, created_at, role, balance_cents, "
                "password_hash FROM users WHERE username = ?",
                (username,),
            ).fetchone()

        # Verify against a dummy hash when the account is missing, so a probe
        # cannot tell the two cases apart by how long the answer took.
        stored = row["password_hash"] if row is not None else dummy_hash()
        matches = verify_password(password, stored)

        if row is None or not matches:
            login_failures.fail(account)
            with db(write=True) as conn:
                audit(
                    conn,
                    "login.failed",
                    target=username,
                    detail="wrong username or password",
                    ip=ip,
                )
            return self._json(401, {"error": "Username or password is incorrect."})

        login_failures.forgive(account)

        # "Remember me" keeps the cookie for 30 days; otherwise it is a
        # session cookie that disappears when the browser closes, and the
        # server-side session dies after 12 hours regardless.
        remember = bool(payload.get("remember"))
        ttl = SESSION_TTL if remember else 12 * 3600

        with db(write=True) as conn:
            token = new_session(conn, row["id"], ttl=ttl)
            # occasionally clear out sessions that have expired, so the table
            # cannot grow without bound on a busy shop
            if int(time.time()) % 30 == 0:
                prune_sessions(conn)
            audit(
                conn,
                "login.ok",
                actor={"id": row["id"], "username": row["username"]},
                target=row["username"],
                detail="remember me" if remember else "session cookie",
                ip=ip,
            )

        user = {
            "id": row["id"],
            "username": row["username"],
            "email": row["email"],
            "created_at": row["created_at"],
            "role": row["role"],
            "balance": dollars(row["balance_cents"]),
        }
        cookie = self._session_cookie(token, SESSION_TTL if remember else None)

        return self._json(200, {"user": user}, [cookie])

    def api_logout(self):
        token = self._cookie_token()
        if token:
            with db(write=True) as conn:
                row = conn.execute(
                    "SELECT u.id, u.username FROM sessions s "
                    "JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
                    (token_hash(token),),
                ).fetchone()
                conn.execute(
                    "DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),)
                )
                if row is not None:
                    audit(
                        conn,
                        "logout",
                        actor={"id": row["id"], "username": row["username"]},
                        target=row["username"],
                        ip=self.client_address[0],
                    )
        # 204 carries no body, only the cookie that drops the session
        self._send(204, b"", None, [("Cache-Control", "no-store"), self._clear_cookie()])

    def api_postcode(self):
        """Verify one ZIP / postal code through Geoapify, with a SQLite cache."""
        user = self._current_user()
        if user is None:
            return self._json(401, {"error": "Not signed in."}, [self._clear_cookie()])

        query = urllib.parse.urlsplit(self.path).query
        params = urllib.parse.parse_qs(query)
        country = (params.get("country", [""])[0] or "").strip().upper()
        code = " ".join((params.get("code", [""])[0] or "").split())

        if not re.fullmatch(r"[A-Z]{2}", country):
            return self._json(400, {"error": "country must be a 2-letter code."})
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 \-]{0,11}", code):
            return self._json(400, {"error": "That does not look like a postal code."})

        if too_many_lookups(self.client_address[0]):
            return self._json(429, {"error": "Too many lookups. Wait a minute."})

        now = int(time.time())
        with db() as conn:
            row = conn.execute(
                "SELECT found, place, formatted, checked_at FROM postcodes "
                "WHERE country = ? AND code = ?",
                (country, code),
            ).fetchone()

        if row and now - (row["checked_at"] or 0) < POSTCODE_TTL:
            if not row["found"]:
                return self._json(404, {"country": country, "code": code, "verified": False})
            return self._json(
                200,
                {
                    "country": country,
                    "code": code,
                    "place": row["place"] or "",
                    "formatted": row["formatted"] or "",
                    "verified": True,
                    "cached": True,
                },
            )

        if not geoapify_key():
            return self._json(503, {"error": "No Geoapify key configured on the server."})

        found = look_up_postcode(country, code)

        with db(write=True) as conn:
            conn.execute(
                "INSERT INTO postcodes (country, code, found, place, formatted, checked_at) "
                "VALUES (?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(country, code) DO UPDATE SET found = excluded.found, "
                "place = excluded.place, formatted = excluded.formatted, "
                "checked_at = excluded.checked_at",
                (
                    country,
                    code,
                    1 if found else 0,
                    (found or {}).get("place", ""),
                    (found or {}).get("formatted", ""),
                    now,
                ),
            )

        if not found:
            return self._json(404, {"country": country, "code": code, "verified": False})

        return self._json(
            200,
            {
                "country": country,
                "code": code,
                "place": found["place"],
                "formatted": found["formatted"],
                "verified": True,
                "cached": False,
            },
        )

    def api_account_email(self, payload):
        """Change the address on the signed-in account."""
        user = self._current_user()
        if user is None:
            return self._json(401, {"error": "Not signed in."})
        if account_throttle.hit(user["id"]):
            return self._error(429, "Too many changes. Wait a few minutes.")

        email = str(payload.get("email", "")).strip()
        if not email:
            return self._json(
                400,
                {
                    "error": "Enter your email address.",
                    "fields": {"email": "Enter your email address."},
                },
            )
        if len(email) > 254 or not EMAIL_RE.match(email):
            return self._json(
                400,
                {
                    "error": "That email address looks off.",
                    "fields": {"email": "That email address looks off."},
                },
            )

        with db(write=True) as conn:
            clash = conn.execute(
                "SELECT id FROM users WHERE email = ? AND id <> ?",
                (email, user["id"]),
            ).fetchone()
            if clash:
                return self._json(
                    409,
                    {
                        "error": "That email is already used by another account.",
                        "fields": {
                            "email": "That email is already used by another account."
                        },
                    },
                )

            conn.execute("UPDATE users SET email = ? WHERE id = ?", (email, user["id"]))
            audit(
                conn,
                "account.email",
                actor=user,
                target=user["username"],
                detail=f"{user['email']} -> {email}",
                ip=self.client_address[0],
            )

        user["email"] = email
        return self._json(200, {"user": user})

    def api_account_password(self, payload):
        """Change the password, proving the current one first."""
        user = self._current_user()
        if user is None:
            return self._json(401, {"error": "Not signed in."})
        if account_throttle.hit(user["id"]):
            return self._error(429, "Too many changes. Wait a few minutes.")

        current = str(payload.get("current", ""))
        password = str(payload.get("password", ""))

        errors = {}
        if not current:
            errors["current"] = "Enter your current password."
        if len(password) < MIN_PASSWORD:
            errors["password"] = f"Use at least {MIN_PASSWORD} characters."
        elif not re.search(r"[A-Za-z]", password):
            errors["password"] = "Add at least one letter."
        elif not re.search(r"\d", password):
            errors["password"] = "Add at least one number."
        elif not re.search(r"[^A-Za-z0-9]", password):
            errors["password"] = "Add at least one symbol."
        elif len(password) > 1024:
            errors["password"] = "That password is too long."
        elif current and password == current:
            errors["password"] = "Pick a password you have not used here."

        if errors:
            return self._json(
                400, {"error": "Please fix the highlighted fields.", "fields": errors}
            )

        with db() as conn:
            row = conn.execute(
                "SELECT password_hash FROM users WHERE id = ?", (user["id"],)
            ).fetchone()

        if row is None:
            return self._json(401, {"error": "Not signed in."})

        if not verify_password(current, row["password_hash"]):
            login_failures.fail(user["username"].lower())
            return self._json(
                400,
                {
                    "error": "That is not your current password.",
                    "fields": {"current": "That is not your current password."},
                },
            )

        login_failures.forgive(user["username"].lower())
        new_hash = hash_password(password)  # slow: keep it outside the transaction
        token = self._cookie_token()

        with db(write=True) as conn:
            conn.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (new_hash, user["id"]),
            )
            # every other session for this account is signed out
            conn.execute(
                "DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?",
                (user["id"], token_hash(token)),
            )
            audit(
                conn,
                "account.password",
                actor=user,
                target=user["username"],
                detail="other sessions signed out",
                ip=self.client_address[0],
            )

        return self._json(200, {"ok": True})

    # ---------------- admin ----------------

    def _require_admin(self):
        """Returns the signed-in admin, or None."""
        user = self._current_user()
        if user is None or user.get("role") != "admin":
            return None
        return user

    def api_admin_data(self):
        """Everything the dashboard shows: totals, users, payment queue."""
        if self._require_admin() is None:
            return self._json(403, {"error": "Admins only."})

        with db() as conn:
            user_rows = conn.execute(
                "SELECT id, username, email, created_at, role, balance_cents "
                "FROM users ORDER BY id"
            ).fetchall()
            payment_rows = conn.execute(
                "SELECT p.id, p.user_id, u.username, p.amount_cents, p.asset, "
                "p.network, p.status, p.created_at, p.decided_at, p.decided_by "
                "FROM payments p JOIN users u ON u.id = p.user_id "
                "ORDER BY p.id DESC"
            ).fetchall()

        users = []
        for row in user_rows:
            user = dict(row)
            user["balance"] = dollars(user.pop("balance_cents"))
            users.append(user)

        payments = []
        for row in payment_rows:
            payment = dict(row)
            payment["amount"] = dollars(payment.pop("amount_cents"))
            payments.append(payment)

        # per-user payment tallies
        per_user = {}
        for pay in payments:
            tally = per_user.setdefault(
                pay["user_id"], {"pending": 0, "confirmed": 0, "failed": 0}
            )
            tally[pay["status"]] += 1

        for user in users:
            user["payments"] = per_user.get(
                user["id"], {"pending": 0, "confirmed": 0, "failed": 0}
            )
            user["paid"] = user["payments"]["confirmed"] > 0

        confirmed = [pay for pay in payments if pay["status"] == "confirmed"]
        stats = {
            "users": len([u for u in users if u["role"] != "admin"]),
            "admins": len([u for u in users if u["role"] == "admin"]),
            "payers": len([u for u in users if u["paid"]]),
            "pending": len([p for p in payments if p["status"] == "pending"]),
            "confirmed": len(confirmed),
            "failed": len([p for p in payments if p["status"] == "failed"]),
            "revenue": dollars(sum(int(round(p["amount"] * 100)) for p in confirmed)),
        }

        return self._json(200, {"stats": stats, "users": users, "payments": payments})

    def api_admin_payment(self, payload):
        """Confirm or fail one pending payment. Confirming credits the wallet.

        The decision is a single conditional UPDATE, so two admins clicking at
        the same moment can only ever produce one winner — the money moves
        once, inside the same transaction as the status change.
        """
        admin = self._require_admin()
        if admin is None:
            return self._json(403, {"error": "Admins only."})
        if admin_throttle.hit(admin["id"]):
            return self._error(429, "Slow down for a moment.")

        try:
            payment_id = int(payload.get("id"))
        except (TypeError, ValueError):
            return self._json(400, {"error": "Which payment?"})

        status = str(payload.get("status", "")).strip().lower()
        if status not in ("confirmed", "failed"):
            return self._json(400, {"error": "Status must be confirmed or failed."})

        now = int(time.time())

        with db(write=True) as conn:
            decided = conn.execute(
                "UPDATE payments SET status = ?, decided_at = ?, decided_by = ? "
                "WHERE id = ? AND status = 'pending'",
                (status, now, admin["id"], payment_id),
            )

            if decided.rowcount != 1:
                row = conn.execute(
                    "SELECT status FROM payments WHERE id = ?", (payment_id,)
                ).fetchone()
                if row is None:
                    return self._json(404, {"error": "No such payment."})
                return self._json(
                    409, {"error": f"That payment is already {row['status']}."}
                )

            row = conn.execute(
                "SELECT user_id, amount_cents FROM payments WHERE id = ?",
                (payment_id,),
            ).fetchone()

            if status == "confirmed":
                credited = conn.execute(
                    "UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?",
                    (row["amount_cents"], row["user_id"]),
                )
                if credited.rowcount != 1:
                    # the account vanished: undo the status change too
                    raise sqlite3.IntegrityError(
                        f"payment {payment_id} has no account to credit"
                    )

            audit(
                conn,
                f"payment.{status}",
                actor=admin,
                target=payment_id,
                detail=(
                    f"{dollars(row['amount_cents']):.2f} for user #{row['user_id']}"
                    + (" (wallet credited)" if status == "confirmed" else " (no funds moved)")
                ),
                ip=self.client_address[0],
            )

        return self._json(200, {"ok": True, "id": payment_id, "status": status})

    def api_my_payments(self):
        """The signed-in visitor's own deposits, newest first."""
        user = self._current_user()
        if user is None:
            return self._json(401, {"error": "Not signed in."}, [self._clear_cookie()])

        with db() as conn:
            rows = conn.execute(
                "SELECT id, amount_cents, asset, network, status, created_at, decided_at "
                "FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 25",
                (user["id"],),
            ).fetchall()

        return self._json(
            200,
            {
                "payments": [
                    {
                        "id": row["id"],
                        "amount": dollars(row["amount_cents"]),
                        "asset": row["asset"],
                        "network": row["network"],
                        "status": row["status"],
                        "created_at": row["created_at"],
                        "decided_at": row["decided_at"],
                    }
                    for row in rows
                ]
            },
        )

    def api_create_payment(self, payload):
        """A signed-in visitor asks to deposit; the request waits for an admin."""
        user = self._current_user()
        if user is None:
            return self._json(401, {"error": "Not signed in."}, [self._clear_cookie()])
        if payment_throttle.hit(user["id"]):
            return self._error(429, "Too many deposit requests. Wait a few minutes.")

        cents, problem = parse_cents(payload.get("amount"), low=2500, high=8000000)
        if problem in ("That is below the minimum.", "That is above the maximum."):
            return self._json(400, {"error": "Deposits run from $25 to $80,000."})
        if cents is None:
            return self._json(400, {"error": problem or "Enter an amount."})
        if problem:
            return self._json(400, {"error": problem})

        asset = str(payload.get("asset") or "USDT").strip()[:12] or "USDT"
        network = str(payload.get("network") or "TRC-20").strip()[:12] or "TRC-20"
        if not re.fullmatch(r"[A-Za-z0-9 .+_-]{1,12}", asset):
            return self._json(400, {"error": "Unsupported asset."})
        if not re.fullmatch(r"[A-Za-z0-9 .+_-]{1,12}", network):
            return self._json(400, {"error": "Unsupported network."})

        # A browser that lost the connection may send the same request again.
        # The key makes that a lookup, not a second payment.
        request_id = str(payload.get("request_id") or "").strip()[:64]
        if request_id and not re.fullmatch(r"[A-Za-z0-9_-]{8,64}", request_id):
            request_id = ""

        with db(write=True) as conn:
            if request_id:
                existing = conn.execute(
                    "SELECT id, amount_cents, asset, network, status FROM payments "
                    "WHERE user_id = ? AND request_id = ?",
                    (user["id"], request_id),
                ).fetchone()
                if existing is not None:
                    return self._json(
                        200,
                        {
                            "payment": {
                                "id": existing["id"],
                                "amount": dollars(existing["amount_cents"]),
                                "asset": existing["asset"],
                                "network": existing["network"],
                                "status": existing["status"],
                            },
                            "replayed": True,
                        },
                    )

            waiting = conn.execute(
                "SELECT COUNT(*) AS n FROM payments WHERE user_id = ? AND status = 'pending'",
                (user["id"],),
            ).fetchone()["n"]
            if waiting >= 20:
                return self._json(
                    429,
                    {
                        "error": (
                            "You already have 20 deposits waiting for review. "
                            "Wait for those to be decided first."
                        )
                    },
                )

            cursor = conn.execute(
                "INSERT INTO payments "
                "(user_id, amount_cents, asset, network, status, request_id, created_at) "
                "VALUES (?, ?, ?, ?, 'pending', ?, ?)",
                (user["id"], cents, asset, network, request_id or None, int(time.time())),
            )
            payment_id = cursor.lastrowid
            audit(
                conn,
                "payment.create",
                actor=user,
                target=payment_id,
                detail=f"{dollars(cents):.2f} {asset} / {network}",
                ip=self.client_address[0],
            )

        return self._json(
            201,
            {
                "payment": {
                    "id": payment_id,
                    "amount": dollars(cents),
                    "asset": asset,
                    "network": network,
                    "status": "pending",
                }
            },
        )

    def api_bundles(self):
        """The ids of the bundles, in page order.

        The page already has the names and prices (assets/data/bundles-data.js);
        this hands it the matching catalogue ids, so the browser never has to
        repeat the id arithmetic and a Buy Now click can only name a real item.
        """
        drops = len(catalogue_rows())
        bundles = len(bundle_rows())
        if not bundles:
            return self._json(200, {"ids": [], "count": 0})
        ids = catalogue_ids(drops + bundles)[drops:]
        return self._json(200, {"ids": ids, "count": len(ids)})

    def api_orders(self):
        """The signed-in account's purchases, newest first."""
        user = self._current_user()
        if user is None:
            return self._json(401, {"error": "Not signed in."}, [self._clear_cookie()])

        with db() as conn:
            rows = conn.execute(
                "SELECT id, goods_id, title, price_cents, created_at "
                "FROM purchases WHERE user_id = ? ORDER BY id DESC LIMIT 100",
                (user["id"],),
            ).fetchall()

        return self._json(
            200,
            {
                "orders": [
                    {
                        "id": row["id"],
                        "goods_id": row["goods_id"],
                        "title": row["title"],
                        "price": dollars(row["price_cents"]),
                        "created_at": row["created_at"],
                    }
                    for row in rows
                ],
                "balance": user["balance"],
            },
        )

    def api_purchase(self, payload):
        """Buy one catalogue item with the wallet balance.

        The price comes from the catalogue on this side of the wire, never from
        the request, and the debit is a single conditional UPDATE — so two
        clicks cannot spend the same money twice and a balance can never go
        below zero.
        """
        user = self._current_user()
        if user is None:
            return self._json(401, {"error": "Not signed in."}, [self._clear_cookie()])
        if purchase_throttle.hit(user["id"]):
            return self._error(429, "Too many purchases. Wait a minute.")

        goods_id = str(payload.get("id") or "").strip()
        item = goods_catalogue().get(goods_id)
        if item is None:
            return self._json(404, {"error": "That item is no longer in the catalogue."})

        price = item["price_cents"]
        now = int(time.time())

        with db(write=True) as conn:
            paid = conn.execute(
                "UPDATE users SET balance_cents = balance_cents - ? "
                "WHERE id = ? AND balance_cents >= ?",
                (price, user["id"], price),
            )

            if paid.rowcount != 1:
                row = conn.execute(
                    "SELECT balance_cents FROM users WHERE id = ?", (user["id"],)
                ).fetchone()
                balance = row["balance_cents"] if row is not None else 0
                return self._json(
                    402,
                    {
                        "error": "Insufficient funds.",
                        "balance": dollars(balance),
                        "price": dollars(price),
                        "missing": dollars(max(0, price - balance)),
                    },
                )

            cursor = conn.execute(
                "INSERT INTO purchases (user_id, goods_id, title, price_cents, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (user["id"], goods_id, item["title"], price, now),
            )
            purchase_id = cursor.lastrowid

            balance = conn.execute(
                "SELECT balance_cents FROM users WHERE id = ?", (user["id"],)
            ).fetchone()["balance_cents"]

            audit(
                conn,
                "purchase",
                actor=user,
                target=goods_id,
                detail=f"{item['title']} for {dollars(price):.2f}",
                ip=self.client_address[0],
            )

        return self._json(
            201,
            {
                "purchase": {
                    "id": purchase_id,
                    "goods_id": goods_id,
                    "title": item["title"],
                    "price": dollars(price),
                    "created_at": now,
                },
                "balance": dollars(balance),
            },
        )

    def api_me(self):
        user = self._current_user()
        if user is None:
            return self._json(401, {"error": "Not signed in."}, [self._clear_cookie()])
        return self._json(200, {"user": user})

    # ---------------- static files ----------------

    def serve_static(self, path):
        rel = unquote(path).lstrip("/") or "index.html"

        if rel in ADMIN_PAGES:
            user = self._current_user()
            if user is None:
                return self._redirect(LOGIN_PATH + "?next=" + quote(rel, safe=""))
            if user.get("role") != "admin":
                # signed in, but not an admin: back to the shop
                return self._redirect("index.html")

        if rel in GATED_PAGES:
            if self._current_user() is None:
                # a guest is offered an account first; login.html is still there
                # for people who already have one (and for the admin console)
                location = SIGNUP_PATH
                if rel != "index.html":
                    # bare filename: the client refuses anything with a slash
                    location += "?next=" + quote(rel, safe="")
                return self._redirect(location)

        name = rel.rsplit("/", 1)[-1]
        if any(rel.startswith(prefix) for prefix in BLOCKED_PREFIXES):
            return self._send(404, b"Not found", "text/plain; charset=utf-8")
        if name in BLOCKED_NAMES or rel.lower().endswith(BLOCKED_SUFFIXES):
            return self._send(404, b"Not found", "text/plain; charset=utf-8")

        target = (WEB_ROOT / rel).resolve()
        try:
            target.relative_to(WEB_ROOT.resolve())
        except ValueError:
            return self._send(403, b"Forbidden", "text/plain; charset=utf-8")

        if target.is_dir():
            target = target / "index.html"
        if not target.is_file():
            return self._send(404, b"Not found", "text/plain; charset=utf-8")

        content_type = CONTENT_TYPES.get(
            target.suffix.lower(),
            mimetypes.guess_type(target.name)[0] or "application/octet-stream",
        )
        body = target.read_bytes()
        stat = target.stat()
        etag = '"%x-%x"' % (stat.st_mtime_ns, stat.st_size)

        # pages are per-session, so never cache them; images and stylesheets
        # may be cached and revalidated cheaply
        if target.suffix.lower() == ".html":
            cache = [("Cache-Control", "no-store")]
        else:
            cache = [("Cache-Control", "no-cache"), ("ETag", etag)]
            if etag in (self.headers.get("If-None-Match") or ""):
                return self._send(304, b"", None, cache)

        csp = PREVIEW_CSP if rel.endswith("-preview.html") else None
        self._send(200, body, content_type, cache, csp=csp)


class Server(ThreadingHTTPServer):
    daemon_threads = True          # a stuck request cannot hold up shutdown
    allow_reuse_address = True
    request_queue_size = 64


def main():
    init_db()

    default_password = ADMIN_PASSWORD == DEFAULT_ADMIN_PASSWORD
    if default_password and not ALLOW_DEFAULT_ADMIN:
        print("")
        print("  ! ---------------------------------------------------------------")
        print("  !  The admin account is using the built-in password.")
        print("  !  Set NL_ADMIN_PASSWORD to something private before anyone")
        print("  !  else can reach this server, or start with")
        print("  !  NL_ALLOW_DEFAULT_ADMIN=1 to silence this warning.")
        print("  ! ---------------------------------------------------------------")
        print("")

    print("Northlight server")
    print(f"  serving  {WEB_ROOT}")
    if DB_KIND == "mysql":
        print(
            "  database mysql://{user}@{host}:{port}/{database}".format(**MYSQL)
        )
    else:
        print(f"  database {DB_PATH}")
    if HTTPS_ONLY:
        print("  cookies  Secure + HSTS (NL_HTTPS=1)")
    if STRICT_HEADERS:
        print("  headers  frame-ancestors 'none' (NL_STRICT_HEADERS=1)")
    print(f"  open     http://localhost:{PORT}/  (Ctrl+C to stop)")

    server = Server((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down")
    finally:
        server.server_close()
        if DB_KIND == "sqlite":
            try:
                with db(write=True) as conn:
                    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            except sqlite3.Error:
                pass


if __name__ == "__main__":
    main()
