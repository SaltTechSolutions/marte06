# Firestore -> CSV Export (Standalone)

This is a standalone Python utility to export all Firestore collections (including subcollections) to CSV files.

- Output directory: `backups/firestore/<YYYYmmdd-HHMMSS>/`
- One CSV per collection path. Example:
  - `members` -> `members.csv`
  - `members/<doc>/payments` -> `members__payments.csv`
- Auth: Uses a Firebase service account JSON (recommended) or the `GOOGLE_APPLICATION_CREDENTIALS` env var.

## 1) Requirements

- Python 3.9+
- Install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r scripts/requirements-export.txt
```

## 2) Service Account

1. Go to: Google Cloud Console -> IAM & Admin -> Service Accounts
2. Select your Firebase/Firestore project
3. Create key (JSON) for a service account with at least "Cloud Datastore Viewer" (roles/datastore.viewer)
4. Download the JSON key locally, e.g. `secrets/serviceAccount.json`

## 3) Run

Either pass credentials explicitly:

```bash
python scripts/export_firestore_to_csv.py \
  --credentials secrets/serviceAccount.json \
  --output backups/firestore
```

Or set the environment variable and omit `--credentials`:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=$PWD/secrets/serviceAccount.json
python scripts/export_firestore_to_csv.py --output backups/firestore
```

Optional: if you need to override the GCP project explicitly, add `--project <PROJECT_ID>`.

## Output

- CSV files will be created under a timestamped directory, e.g. `backups/firestore/20250101-120000/`
- Each CSV aggregates all documents for that collection path. Nested data (arrays/maps) are JSON-encoded. Timestamps are ISO-8601.

## Notes

- This script only exports Firestore. If you also want Authentication users, Realtime Database, or Storage metadata exported, let us know to add companion scripts.
