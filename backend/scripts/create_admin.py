"""One-off CLI to create an admin user directly in whatever database
DATABASE_URL points at. Deliberately not part of seed_db.py / seed_users.yaml
— admin credentials shouldn't be baked into a public repo's seed data.

Usage (from backend/):
    .venv/Scripts/python.exe scripts/create_admin.py <username> "<display name>" <password>

Safe to re-run: skips (never overwrites) a user that already exists.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import Base, engine, get_session
from app.db_models import UserRecord
from app.security import hash_password


def main():
    if len(sys.argv) != 4:
        print('Usage: create_admin.py <username> "<display name>" <password>')
        sys.exit(1)

    username, display_name, password = sys.argv[1], sys.argv[2], sys.argv[3]

    Base.metadata.create_all(engine)

    with get_session() as session:
        existing = session.query(UserRecord).filter_by(username=username).one_or_none()
        if existing is not None:
            print(f"User '{username}' already exists (role={existing.role}) -- left untouched.")
            return

        session.add(
            UserRecord(
                username=username,
                display_name=display_name,
                role="admin",
                password_hash=hash_password(password),
            )
        )

    print(f"Created admin user '{username}' ({display_name}).")


if __name__ == "__main__":
    main()
