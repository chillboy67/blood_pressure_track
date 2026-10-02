import sqlite3
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

from tracker import create_app, get_db, init_db


class TrackerTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        self.database = Path(self.temp_directory.name) / "test.db"
        self.measurement_time = datetime.now().strftime("%Y-%m-%dT%H:%M")
        self.app = create_app(
            {
                "TESTING": True,
                "DATABASE": str(self.database),
            }
        )
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_directory.cleanup()

    def create_record(self, **overrides):
        data = {
            "high_pressure": "128",
            "low_pressure": "82",
            "pulse": "72",
            "arm": "left",
            "measured_at": self.measurement_time,
            "note": "晨起测量",
        }
        data.update(overrides)
        return self.client.post("/submit", data=data)

    def records(self):
        return self.client.get("/api/records?days=all").get_json()

    def test_factory_initializes_database_and_health_endpoint(self):
        self.assertTrue(self.database.exists())
        self.assertEqual(self.client.get("/health").get_json(), {"status": "ok"})

        runner = self.app.test_cli_runner()
        result = runner.invoke(args=["init-db"])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("Database initialized.", result.output)

    def test_database_connection_is_reused_and_closed_per_context(self):
        with self.app.app_context():
            first = get_db()
            second = get_db()
            self.assertIs(first, second)
            first.execute("SELECT 1").fetchone()

        with self.assertRaises(sqlite3.ProgrammingError):
            first.execute("SELECT 1").fetchone()

    def test_submit_redirects_to_result_and_persists_all_fields(self):
        response = self.create_record()

        self.assertEqual(response.status_code, 303)
        self.assertIn("/result.html?", response.headers["Location"])
        self.assertIn("high=128", response.headers["Location"])
        self.assertIn("low=82", response.headers["Location"])
        self.assertIn("pulse=72", response.headers["Location"])

        records = self.records()
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["pulse"], 72)
        self.assertEqual(records[0]["arm"], "left")
        self.assertEqual(
            records[0]["measured_at"], self.measurement_time.replace("T", " ")
        )
        self.assertEqual(records[0]["note"], "晨起测量")
        self.assertEqual(records[0]["level"], "high-normal")

    def test_server_validation_rejects_malformed_and_out_of_range_values(self):
        invalid_cases = (
            {"high_pressure": "abc"},
            {"high_pressure": ""},
            {"high_pressure": "0"},
            {"high_pressure": "999"},
            {"high_pressure": "70", "low_pressure": "90"},
            {"low_pressure": "abc"},
            {"low_pressure": "0"},
            {"pulse": "999"},
            {"arm": "center"},
            {"measured_at": "not-a-date"},
            {"note": "x" * 101},
        )

        for values in invalid_cases:
            with self.subTest(values=values):
                response = self.create_record(**values)
                self.assertEqual(response.status_code, 400)
                self.assertIn("errors", response.get_json())

        self.assertEqual(self.records(), [])

    def test_history_is_sorted_newest_first(self):
        self.create_record(measured_at="2025-01-01T08:00", note="较早")
        self.create_record(measured_at="2026-01-01T08:00", note="较新")

        records = self.records()
        self.assertEqual([record["note"] for record in records], ["较新", "较早"])

    def test_edit_escapes_notes_and_delete_removes_record(self):
        self.create_record(note="{{ 7 * 7 }}<script>alert(1)</script>")
        edit_page = self.client.get("/edit/1")
        self.assertEqual(edit_page.status_code, 200)
        self.assertNotIn(b"<script>alert(1)</script>", edit_page.data)
        self.assertIn(b"&lt;script&gt;alert(1)&lt;/script&gt;", edit_page.data)

        edit_response = self.client.post(
            "/edit/1",
            data={
                "high_pressure": "118",
                "low_pressure": "76",
                "pulse": "68",
                "arm": "right",
                "measured_at": self.measurement_time,
                "note": "复测",
            },
        )
        self.assertEqual(edit_response.status_code, 303)

        record = self.records()[0]
        self.assertEqual(record["high_pressure"], 118)
        self.assertEqual(record["arm"], "right")
        self.assertEqual(record["note"], "复测")

        delete_response = self.client.post("/delete/1")
        self.assertEqual(delete_response.status_code, 204)
        self.assertEqual(self.records(), [])
        self.assertEqual(self.client.post("/delete/1").status_code, 404)

    def test_stats_insight_and_csv_export(self):
        self.create_record(note="=unsafe formula")

        stats = self.client.get("/api/stats").get_json()
        self.assertEqual(stats["total"], 1)
        self.assertEqual(stats["latest"]["high_pressure"], 128)

        insight = self.client.post("/api/insight").get_json()
        self.assertIn("近 30 天共记录 1 次", insight["text"])

        export_response = self.client.get("/export")
        self.assertEqual(export_response.status_code, 200)
        self.assertIn("attachment", export_response.headers["Content-Disposition"])
        csv_text = export_response.data.decode("utf-8-sig")
        self.assertIn("收缩压(mmHg)", csv_text)
        self.assertIn("'=unsafe formula", csv_text)

    def test_old_database_schema_is_migrated_without_losing_data(self):
        self.database.unlink()
        connection = sqlite3.connect(self.database)
        connection.execute(
            """
            CREATE TABLE blood_pressure (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                high_pressure INTEGER,
                low_pressure INTEGER,
                result TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            INSERT INTO blood_pressure (
                high_pressure, low_pressure, result, timestamp
            ) VALUES (145, 92, 'High Blood Pressure', '2026-10-01 08:00:00')
            """
        )
        connection.commit()
        connection.close()

        with self.app.app_context():
            init_db()

        records = self.records()
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["high_pressure"], 145)
        self.assertEqual(records[0]["measured_at"], "2026-10-01 08:00:00")
        self.assertEqual(records[0]["arm"], "left")


if __name__ == "__main__":
    unittest.main()
