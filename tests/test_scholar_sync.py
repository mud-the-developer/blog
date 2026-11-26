import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import scripts.sync_scholar_metrics as scholar


class ScholarSyncTests(unittest.TestCase):
    def test_validate_entries_normalizes_and_rejects_empty(self) -> None:
        valid = scholar.validate_entries(
            [
                {
                    "title": "Test Paper",
                    "authors": "J Kim",
                    "citationCount": 12,
                    "year": 2026,
                    "scholarUrl": "https://example.org/paper",
                    "citationUpdatedAt": "2026-11",
                }
            ]
        )
        self.assertEqual(len(valid), 1)
        self.assertEqual(valid[0]["citationCount"], 12)
        with self.assertRaises(ValueError):
            scholar.validate_entries([])

    def test_main_keeps_existing_cache_on_network_failure(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "publications.json"
            original = json.dumps([{"title": "Cached Paper", "citationCount": 5}])
            out.write_text(original, encoding="utf-8")
            with mock.patch.object(
                scholar, "fetch_scholar_json", side_effect=TimeoutError("offline")
            ):
                rc = scholar.main(["--output", str(out)])
            self.assertEqual(rc, 0)
            self.assertEqual(out.read_text(encoding="utf-8"), original)


if __name__ == "__main__":
    unittest.main()
