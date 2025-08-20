#!/usr/bin/env python3

from __future__ import annotations

import argparse
import base64
import csv
import datetime as dt
import json
import os
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore



# Types from google-cloud-firestore
try:
    from google.cloud.firestore_v1 import DocumentReference
except Exception:  # pragma: no cover
    DocumentReference = Any  # type: ignore


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export Firestore to CSV files")
    parser.add_argument(
        "--credentials",
        dest="credentials_path",
        help="Path to Firebase service account JSON. If omitted, uses GOOGLE_APPLICATION_CREDENTIALS.",
    )
    parser.add_argument(
        "--output",
        dest="output_dir",
        default=str(Path("backups") / "firestore"),
        help="Base output directory (default: backups/firestore)",
    )
    parser.add_argument(
        "--project",
        dest="project_id",
        default=None,
        help="Optional GCP Project ID override",
    )
    return parser.parse_args()


def init_firestore(creds_path: str | None, project_id: str | None):
    if firebase_admin._apps:
        return firestore.client()

    cred = None
    if creds_path:
        cred = credentials.Certificate(creds_path)
    else:
        # Try env var if not provided explicitly
        gac = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if gac and Path(gac).exists():
            cred = credentials.Certificate(gac)

    if cred is not None:
        firebase_admin.initialize_app(cred, options={"projectId": project_id} if project_id else None)
    else:
        # Attempt default initialization (may work in some environments)
        firebase_admin.initialize_app(options={"projectId": project_id} if project_id else None)

    return firestore.client()


def ensure_timestamped_dir(base_output: str) -> Path:
    ts = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    out = Path(base_output) / ts
    out.mkdir(parents=True, exist_ok=True)
    return out


def safe_serialize(value: Any) -> Any:
    # Normalize Firestore-special values into CSV-friendly representations
    if value is None:
        return ""

    # Datetime (Firestore returns timezone-aware datetime)
    if isinstance(value, dt.datetime):
        try:
            return value.isoformat()
        except Exception:
            return str(value)

    # DocumentReference -> path
    try:
        from google.cloud.firestore_v1 import DocumentReference as _DocRef  # type: ignore
        if isinstance(value, _DocRef):
            return value.path
    except Exception:
        if hasattr(value, "path") and hasattr(value, "_client"):
            return getattr(value, "path", str(value))

    # GeoPoint -> "lat,lon"
    # Detect by duck-typing: has latitude/longitude attributes
    if hasattr(value, "latitude") and hasattr(value, "longitude"):
        try:
            return f"{value.latitude},{value.longitude}"
        except Exception:
            pass

    # Bytes -> base64
    if isinstance(value, (bytes, bytearray)):
        return base64.b64encode(value).decode("utf-8")

    # Primitive types
    if isinstance(value, (bool, int, float, str)):
        return value

    # Lists / dicts -> JSON string
    if isinstance(value, (list, dict)):
        try:
            return json.dumps(value, ensure_ascii=False)
        except Exception:
            return str(value)

    # Fallback
    return str(value)


def get_collection_path(col_ref) -> str:
    """Compute a collection's path from its parent and id.

    In some client versions, CollectionReference may not expose `.path`.
    This utility builds it as `<parent.path>/<id>` or just `<id>` for root collections.
    """
    try:
        parent = getattr(col_ref, "parent", None)
        if parent is None:
            return col_ref.id
        return f"{parent.path}/{col_ref.id}"
    except Exception:
        return getattr(col_ref, "id", "unknown_collection")


def collect_docs_for_collection(col_ref) -> Tuple[str, List[Dict[str, Any]]]:
    """Collect documents for a collection into serializable dicts.

    Returns (collection_path, docs_as_dicts)
    """
    col_path = get_collection_path(col_ref)  # e.g., "members" or "members/abc/payments"
    docs_data: List[Dict[str, Any]] = []

    for doc_snap in col_ref.stream():
        raw = doc_snap.to_dict() or {}
        row: Dict[str, Any] = {"id": doc_snap.id}
        for k, v in raw.items():
            row[k] = safe_serialize(v)
        docs_data.append(row)

    return col_path, docs_data


def write_csv(out_dir: Path, collection_path: str, docs: List[Dict[str, Any]]):
    if not docs:
        # Still write an empty CSV with only id header for consistency
        headers = ["id"]
    else:
        # Build header union across docs, keeping 'id' first
        keys = set()
        for d in docs:
            keys.update(d.keys())
        keys.discard("id")
        headers = ["id"] + sorted(keys)

    safe_name = collection_path.replace("/", "__") + ".csv"
    csv_path = out_dir / safe_name

    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        for d in docs:
            # Ensure all values are serialized safely
            normalized = {k: safe_serialize(v) for k, v in d.items()}
            writer.writerow(normalized)

    print(f"✔ Wrote {csv_path}")


def export_all(client, out_dir: Path):
    visited_col_paths = set()

    def walk_collection(col_ref):
        col_path, docs = collect_docs_for_collection(col_ref)
        if col_path not in visited_col_paths:
            write_csv(out_dir, col_path, docs)
            visited_col_paths.add(col_path)

        # Recurse into subcollections
        for doc_snap in col_ref.stream():
            for sub_col in doc_snap.reference.collections():
                walk_collection(sub_col)

    # Root-level collections
    for root_col in client.collections():
        walk_collection(root_col)


def main():
    args = parse_args()
    client = init_firestore(args.credentials_path, args.project_id)

    out_dir = ensure_timestamped_dir(args.output_dir)
    print(f"Exporting Firestore to: {out_dir}")

    export_all(client, out_dir)

    print("\nDone.")


if __name__ == "__main__":
    main()
