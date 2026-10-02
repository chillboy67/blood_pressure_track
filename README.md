# Blood Pressure Tracker

**English** | [中文](./README.cn.md)

A Flask, SQLite, and vanilla JavaScript application for recording and reviewing blood-pressure measurements. It supports creation, statistics, trends, editing, deletion, and CSV export.

> This project is for learning and personal record keeping only. It does not provide medical diagnosis.

## Features

- Record systolic/diastolic pressure, pulse, arm, measurement time, and notes
- Six-level blood-pressure classification
- Recent measurements, seven-day averages, 30-day high-reading ratio, and trend chart
- Rule-based 30-day trend summary
- History filters, stable newest-first ordering, editing, and deletion
- UTF-8 CSV export with spreadsheet-formula protection
- Automatic migration of databases created by the original two-field app
- Mock-data fallback for static frontend previews

## Backend design

- `create_app()` application factory with isolated test and deployment configuration
- One SQLite connection per Flask context, reused through `g` and closed at teardown
- Automatic schema initialization and legacy migration for every startup method
- Central server-side validation for types, ranges, field relationships, dates, arms, and note length
- Jinja autoescaping for the dynamic edit template; other pages are static and contain no injected user data
- Debug mode disabled by default
- Configurable database path through `BLOOD_PRESSURE_DATABASE`
- `/health` database health endpoint

## Run locally

```bash
python3 -m venv env
source env/bin/activate        # Windows: env\Scripts\activate
python -m pip install -r requirements.txt
python tracker.py
```

Open <http://127.0.0.1:5000/>. Use the Flask server for full functionality; `npm run dev` is only a non-persistent static preview.

Development mode must be enabled explicitly:

```bash
flask --app tracker run --debug
```

Use another database path when needed:

```bash
BLOOD_PRESSURE_DATABASE=/absolute/path/data.db python tracker.py
```

Initialize or migrate the configured database manually:

```bash
flask --app tracker init-db
```

## Routes

| Path | Method | Purpose |
|---|---|---|
| `/`, `/index.html` | GET | Dashboard and entry form |
| `/result.html?high=&low=&pulse=` | GET | Direct-linkable result page |
| `/history.html` | GET | History page |
| `/health` | GET | Database health check |
| `/submit` | POST | Create a record |
| `/edit/<id>` | GET / POST | Edit a record |
| `/delete/<id>` | POST | Delete a record |
| `/export` | GET | Export all records as CSV |
| `/api/records?days=30` | GET | Records for a period; use `days=all` for all |
| `/api/stats` | GET | Dashboard statistics |
| `/api/insight` | POST | 30-day trend summary |

Form fields are `high_pressure`, `low_pressure`, `pulse`, `arm`, `measured_at`, and `note`. Invalid submissions return HTTP 400 and are not stored.

## Structure

```text
.github/workflows/tests.yml  Continuous integration checks
tracker.py                  Application factory, routes, validation, and SQLite access
index.html                  Dashboard and submission form
result.html                 Result page
history.html                History page
templates/edit.html         Server-rendered edit form
static/app.js               Frontend behavior and API integration
tests/test_tracker.py       Backend regression tests
requirements.txt            Python dependencies
```

## Tests

```bash
env/bin/python -m unittest discover -s tests -v
node --check static/app.js
npm run build
```

Tests use isolated application instances and temporary SQLite databases. GitHub Actions runs the tests, syntax check, and static-build consistency check for pushes and pull requests.

## Design references

- [Flask Tutorial](https://flask.palletsprojects.com/tutorial/): application factory, context-bound database connection, and CLI
- [miguelgrinberg/microblog](https://github.com/miguelgrinberg/microblog): configuration and application organization
- [derdilla/blood-pressure-monitor-fl](https://github.com/derdilla/blood-pressure-monitor-fl): blood-pressure fields, trends, and export workflows
- [wger-project/wger](https://github.com/wger-project/wger): measurement bounds, stable ordering, indexes, and regression tests
