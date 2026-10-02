# Blood Pressure Tracker

**English** | [中文](./README.cn.md)

A Flask, SQLite, and vanilla JavaScript application for recording and reviewing blood-pressure measurements. The current frontend is fully connected to the Python backend and supports creation, statistics, trends, editing, deletion, and CSV export.

> This project is for learning and personal record keeping only. It does not provide medical diagnosis.

## Features

- Record systolic/diastolic pressure, pulse, arm, measurement time, and notes
- Six-level blood-pressure classification
- Recent measurements, seven-day averages, 30-day high-reading ratio, and trend chart
- Rule-based 30-day trend summary
- History filters, editing, and deletion
- UTF-8 CSV export
- Automatic migration of databases created by the original two-field app
- Mock-data fallback for static frontend previews

## Run locally

```bash
python3 -m venv env
source env/bin/activate        # Windows: env\Scripts\activate
python -m pip install -r requirements.txt
python tracker.py
```

Open <http://127.0.0.1:5000/>. Use the Flask server for full functionality; `npm run dev` is only a non-persistent static preview.

## Routes

| Path | Method | Purpose |
|---|---|---|
| `/`, `/index.html` | GET | Dashboard and entry form |
| `/result.html?high=&low=&pulse=` | GET | Direct-linkable result page |
| `/history.html` | GET | History page |
| `/submit` | POST | Create a record |
| `/edit/<id>` | GET / POST | Edit a record |
| `/delete/<id>` | POST | Delete a record |
| `/export` | GET | Export all records as CSV |
| `/api/records?days=30` | GET | Records for a period; use `days=all` for all |
| `/api/stats` | GET | Dashboard statistics |
| `/api/insight` | POST | 30-day trend summary |

Form fields are `high_pressure`, `low_pressure`, `pulse`, `arm`, `measured_at`, and `note`.

## Structure

```text
tracker.py              Flask application and SQLite access
index.html              Dashboard and submission form
result.html             Result page
history.html            History page
templates/edit.html     Server-rendered edit form
static/app.js           Frontend behavior and API integration
tests/test_tracker.py   Backend regression tests
requirements.txt        Python dependencies
```

## Tests

```bash
env/bin/python -m unittest discover -s tests -v
node --check static/app.js
```

The Python tests use a temporary SQLite database and do not modify the application database.
