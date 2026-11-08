#!/usr/bin/env python3
"""
Copy an existing SQLite database into MySQL / MariaDB (XAMPP).

You only need this if you already have accounts, deposits or purchases in
server/data/northlight.db and you want them in MySQL. A fresh install needs
nothing but the import of database/northlight.sql.

    # 1. import the schema once (phpMyAdmin → Import, or:)
    mysql -u root northlight < database/northlight.sql

    # 2. copy the rows over
    NL_MYSQL_USER=root NL_MYSQL_PASSWORD= \\
        python3 database/sqlite_to_mysql.py [server/data/northlight.db]

    # on Windows use:  set NL_DB_KIND=mysql  then the python command

It is safe to run twice: rows that already exist (same primary key) are
replaced, never duplicated. Ids are preserved, so sessions and payments keep
pointing at the right account.
"""

import os
import sqlite3
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "server"))

import app  # noqa: E402  (reuses the same hashing/parsing rules)

TABLES = [
    # (table, columns)  — parents first so foreign keys stay satisfied
    (
        "users",
        ["id", "username", "email", "password_hash", "created_at", "role", "balance_cents"],
    ),
    ("sessions", ["token_hash", "user_id", "expires_at", "created_at"]),
    (
        "payments",
        [
            "id",
            "user_id",
            "amount_cents",
            "asset",
            "network",
            "status",
            "request_id",
            "created_at",
            "decided_at",
            "decided_by",
        ],
    ),
    ("purchases", ["id", "user_id", "goods_id", "title", "price_cents", "created_at"]),
    ("audit", ["id", "at", "actor_id", "actor", "action", "target", "detail", "ip"]),
    ("postcodes", ["country", "code", "found", "place", "formatted", "checked_at"]),
]


def main() -> int:
    source = sys.argv[1] if len(sys.argv) > 1 else str(app.DB_PATH)
    if not os.path.exists(source):
        print(f"No SQLite database at {source} — nothing to copy.")
        return 1

    print(f"reading  {source}")
    print(
        "writing  mysql://{user}@{host}:{port}/{database}".format(**app.MYSQL)
    )

    lite = sqlite3.connect(source)
    lite.row_factory = sqlite3.Row
    target = app._mysql_connect()

    total = 0
    for table, columns in TABLES:
        try:
            rows = lite.execute(f"SELECT {', '.join(columns)} FROM {table}").fetchall()
        except sqlite3.OperationalError:
            print(f"  {table:<10} skipped (not in the SQLite file)")
            continue

        placeholders = ", ".join(["?"] * len(columns))
        statement = (
            f"REPLACE INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"
        )
        for row in rows:
            target.execute(statement, tuple(row[column] for column in columns))
        target.commit()
        total += len(rows)
        print(f"  {table:<10} {len(rows):>6} rows")

    target.close()
    lite.close()
    print(f"done — {total} rows copied. Ids are unchanged.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
