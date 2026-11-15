
import time

from app import DB_KIND, db


TOTAL_TO_INSERT = 150
TEST_PREFIX = "NL PAGINATION TEST"

CATEGORIES = [
    "UI Kits",
    "Website Templates",
    "E-books",
    "Software",
    "Design Assets",
    "Developer Resources",
    "Online Courses",
    "Productivity Templates",
]

PRODUCTS = [
    "Modern Dashboard Kit",
    "Creative Portfolio Template",
    "Business Website Template",
    "Python Developer Guide",
    "Digital Marketing Workbook",
    "Mobile App UI Collection",
    "E-commerce Design Kit",
    "Frontend Developer Toolkit",
    "Project Management Template",
    "Professional Icon Collection",
]

CREATORS = [
    "Northlight Test Studio",
    "Digital Craft Studio",
    "Creative Resources Lab",
    "Independent Design Works",
    "Modern Software Studio",
]

FORMATS = [
    "HTML, CSS, JavaScript",
    "PDF",
    "Figma",
    "ZIP",
    "DOCX, PDF",
]

COUNTRIES = [
    "US", "GB", "CA", "NG", "AU",
    "DE", "FR", "IN", "JP", "BR",
    "ZA", "SG", "NL", "SE", "NZ",
]


def main():
    if DB_KIND != "mysql":
        raise SystemExit(
            "Wrong database configuration. Expected MySQL/TiDB."
        )

    print("Preparing 150 fictional pagination test products.")

    now = int(time.time())

    with db(write=True) as conn:

        existing = conn.execute(
            "SELECT COUNT(*) AS total FROM expensive_products "
            "WHERE title LIKE ?",
            (TEST_PREFIX + "%",)
        ).fetchone()

        if existing and int(existing["total"]) > 0:
            raise SystemExit(
                "Test products already exist. No records inserted."
            )

        for i in range(TOTAL_TO_INSERT):
            number = i + 1

            title = (
                f"{TEST_PREFIX} {number:03d} - "
                f"{PRODUCTS[i % len(PRODUCTS)]}"
            )

            creator = CREATORS[i % len(CREATORS)]
            category = CATEGORIES[i % len(CATEGORIES)]
            formats = FORMATS[i % len(FORMATS)]
            country_code = COUNTRIES[i % len(COUNTRIES)]

            license_type = (
                "Commercial-use licence"
                if i % 2 == 0
                else "Personal-use licence"
            )

            refund_period = "3 days"

            price_cents = 900 + (i * 125)

            description = (
            'EXTREME AVS✅ Comes with Extra info: Phone+EMAIL+IP🔥 FIRSTHAND';

            )

            created_at = now - i

            conn.execute(
                """
                INSERT INTO expensive_products (
                    title,
                    creator,
                    category,
                    formats,
                    license,
                    refund_period,
                    country_code,
                    price_cents,
                    blurb,
                    created_at,
                    created_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                """,
                (
                    title,
                    creator,
                    category,
                    formats,
                    license_type,
                    refund_period,
                    country_code,
                    price_cents,
                    description,
                    created_at,
                )
            )

    print("Successfully inserted 150 test products.")
    print("Your existing products were left untouched.")


if __name__ == "__main__":
    main()
