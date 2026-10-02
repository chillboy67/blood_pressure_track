import sqlite3
import tempfile
import unittest
from pathlib import Path

from tracker import app, init_db


class TrackerTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        self.original_database = app.config["DATABASE"]
        app.config.update(
            TESTING=True,
            DATABASE=str(Path(self.temp_directory.name) / "test.db"),
        )
        init_db()
        self.client = app.test_client()

    def tearDown(self):
        app.config["DATABASE"] = self.original_database
        self.temp_directory.cleanup()

    def create_record(self, **overrides):
        data = {
            "high_pressure": "128",
            "low_pressure": "82",
            "pulse": "72",
            "arm": "left",
            "measured_at": "2026-10-02T08:30",
            "note": "晨起测量",
        }
        data.update(overrides)
        return self.client.post("/submit", data=data)

    def test_submit_redirects_to_result_and_persists_all_fields(self):
        response = self.create_record()

        self.assertEqual(response.status_code, 303)
        self.assertIn("/result.html?", response.headers["Location"])
        self.assertIn("high=128", response.headers["Location"])
        self.assertIn("low=82", response.headers["Location"])
        self.assertIn("pulse=72", response.headers["Location"])

        records = self.client.get("/api/records?days=all").get_json()
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["pulse"], 72)
        self.assertEqual(records[0]["arm"], "left")
        self.assertEqual(records[0]["measured_at"], "2026-10-02 08:30")
        self.assertEqual(records[0]["note"], "晨起测量")
        self.assertEqual(records[0]["level"], "high-normal")

    def test_server_validation_rejects_invalid_values(self):
        response = self.create_record(high_pressure="70", low_pressure="90")

        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertIn("low_pressure", payload["errors"])
        self.assertEqual(self.client.get("/api/records?days=all").get_json(), [])

    def test_edit_and_delete_record(self):
        self.create_record()
        edit_page = self.client.get("/edit/1")
        self.assertEqual(edit_page.status_code, 200)
        self.assertIn("编辑记录".encode(), edit_page.data)

        edit_response = self.client.post(
            "/edit/1",
            data={
                "high_pressure": "118",
                "low_pressure": "76",
                "pulse": "68",
                "arm": "right",
                "measured_at": "2026-10-02T09:00",
                "note": "复测",
            },
        )
        self.assertEqual(edit_response.status_code, 303)

        record = self.client.get("/api/records?days=all").get_json()[0]
        self.assertEqual(record["high_pressure"], 118)
        self.assertEqual(record["arm"], "right")
        self.assertEqual(record["note"], "复测")

        delete_response = self.client.post("/delete/1")
        self.assertEqual(delete_response.status_code, 204)
        self.assertEqual(self.client.get("/api/records?days=all").get_json(), [])
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
        database = Path(app.config["DATABASE"])
        database.unlink()
        connection = sqlite3.connect(database)
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

        init_db()

        records = self.client.get("/api/records?days=all").get_json()
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["high_pressure"], 145)
        self.assertEqual(records[0]["measured_at"], "2026-10-01 08:00:00")
        self.assertEqual(records[0]["arm"], "left")


if __name__ == "__main__":
    unittest.main()
