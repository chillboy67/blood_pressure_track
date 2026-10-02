from __future__ import annotations

import csv
import io
import sqlite3
from collections.abc import Mapping
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from flask import (
    Flask,
    Response,
    abort,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    url_for,
)
from flask.typing import ResponseReturnValue

BASE_DIR = Path(__file__).resolve().parent

app = Flask(
    __name__,
    static_folder=str(BASE_DIR / "static"),
    static_url_path="/static",
    template_folder=str(BASE_DIR / "templates"),
)
app.config["DATABASE"] = str(BASE_DIR / "data.db")
setattr(app.json, "ensure_ascii", False)

RECORD_SELECT = """
    SELECT
        id,
        high_pressure,
        low_pressure,
        pulse,
        COALESCE(NULLIF(arm, ''), 'left') AS arm,
        COALESCE(NULLIF(measured_at, ''), timestamp) AS measured_at,
        COALESCE(note, '') AS note,
        COALESCE(result, '') AS result
    FROM blood_pressure
"""


def get_db() -> sqlite3.Connection:
    """Open a short-lived SQLite connection for the current operation."""
    database = Path(app.config["DATABASE"])
    database.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    """Create the current schema and migrate databases made by the old app."""
    connection = get_db()
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS blood_pressure (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                high_pressure INTEGER NOT NULL,
                low_pressure INTEGER NOT NULL,
                pulse INTEGER,
                arm TEXT NOT NULL DEFAULT 'left',
                measured_at TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                result TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
            """
        )

        columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(blood_pressure)").fetchall()
        }
        migrations = {
            "pulse": "INTEGER",
            "arm": "TEXT NOT NULL DEFAULT 'left'",
            "measured_at": "TEXT",
            "note": "TEXT NOT NULL DEFAULT ''",
        }
        for column, definition in migrations.items():
            if column not in columns:
                connection.execute(
                    f"ALTER TABLE blood_pressure ADD COLUMN {column} {definition}"
                )

        # Old versions only had timestamp. Keep those rows and expose that value
        # through the new measured_at field.
        connection.execute(
            """
            UPDATE blood_pressure
            SET measured_at = timestamp
            WHERE measured_at IS NULL OR measured_at = ''
            """
        )
        connection.execute(
            "UPDATE blood_pressure SET arm = 'left' WHERE arm IS NULL OR arm = ''"
        )
        connection.execute(
            "UPDATE blood_pressure SET note = '' WHERE note IS NULL"
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_blood_pressure_measured_at
            ON blood_pressure(measured_at)
            """
        )
        connection.commit()
    finally:
        connection.close()


def classify_bp(high: int, low: int) -> dict[str, str]:
    """Use the same six-level classification shown by the frontend."""
    if high < 90 or low < 60:
        return {"level": "low", "label": "低血压"}
    if high >= 180 or low >= 110:
        return {"level": "grade3", "label": "3 级高血压"}
    if high >= 160 or low >= 100:
        return {"level": "grade2", "label": "2 级高血压"}
    if high >= 140 or low >= 90:
        return {"level": "grade1", "label": "1 级高血压"}
    if high >= 120 or low >= 80:
        return {"level": "high-normal", "label": "正常高值"}
    return {"level": "normal", "label": "正常"}


def check_hypertension(high: int, low: int) -> str:
    """Backward-compatible helper kept for callers of the original project."""
    return "High Blood Pressure" if high >= 140 or low >= 90 else "Normal"


def _parse_integer(
    form: Mapping[str, Any],
    name: str,
    label: str,
    minimum: int,
    maximum: int,
    errors: dict[str, str],
    *,
    required: bool,
) -> int | None:
    raw_value = str(form.get(name, "")).strip()
    if not raw_value:
        if required:
            errors[name] = f"请填写{label}"
        return None

    try:
        value = int(raw_value)
    except ValueError:
        errors[name] = f"{label}必须是整数"
        return None

    if not minimum <= value <= maximum:
        errors[name] = f"{label}需在 {minimum}–{maximum} 之间"
        return None
    return value


def validate_record(form: Mapping[str, Any]) -> tuple[dict[str, Any], dict[str, str]]:
    """Validate and normalize both create and edit form submissions."""
    errors: dict[str, str] = {}
    high = _parse_integer(
        form, "high_pressure", "收缩压", 60, 260, errors, required=True
    )
    low = _parse_integer(
        form, "low_pressure", "舒张压", 30, 160, errors, required=True
    )
    pulse = _parse_integer(
        form, "pulse", "脉搏", 30, 220, errors, required=False
    )

    if high is not None and low is not None and high <= low:
        errors["low_pressure"] = "收缩压需大于舒张压，请检查输入"

    arm = str(form.get("arm", "left")).strip() or "left"
    if arm not in {"left", "right"}:
        errors["arm"] = "测量部位只能是左臂或右臂"

    measured_raw = str(form.get("measured_at", "")).strip()
    if measured_raw:
        measured_at = None
        for date_format in (
            "%Y-%m-%dT%H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d %H:%M:%S",
        ):
            try:
                measured_at = datetime.strptime(measured_raw, date_format)
                break
            except ValueError:
                continue
        if measured_at is None:
            errors["measured_at"] = "测量时间格式不正确"
    else:
        measured_at = datetime.now()

    note = str(form.get("note", "")).strip()
    if len(note) > 100:
        errors["note"] = "备注最多 100 字"

    data: dict[str, Any] = {
        "high_pressure": high,
        "low_pressure": low,
        "pulse": pulse,
        "arm": arm,
        "measured_at": (
            measured_at.strftime("%Y-%m-%d %H:%M") if measured_at else None
        ),
        "note": note,
    }
    if high is not None and low is not None:
        data["classification"] = classify_bp(high, low)
    return data, errors


def row_to_record(row: sqlite3.Row) -> dict[str, Any]:
    high = int(row["high_pressure"])
    low = int(row["low_pressure"])
    classification = classify_bp(high, low)
    return {
        "id": int(row["id"]),
        "high_pressure": high,
        "low_pressure": low,
        "pulse": int(row["pulse"]) if row["pulse"] is not None else None,
        "arm": row["arm"] or "left",
        "measured_at": row["measured_at"],
        "note": row["note"] or "",
        "result": classification["label"],
        "level": classification["level"],
    }


def fetch_records(days: int | None = None) -> list[dict[str, Any]]:
    query = RECORD_SELECT
    parameters: list[Any] = []
    if days is not None:
        cutoff = datetime.now() - timedelta(days=days)
        query += """
            WHERE datetime(COALESCE(NULLIF(measured_at, ''), timestamp))
                >= datetime(?)
        """
        parameters.append(cutoff.strftime("%Y-%m-%d %H:%M:%S"))
    query += " ORDER BY datetime(measured_at) DESC, id DESC"

    connection = get_db()
    try:
        rows = connection.execute(query, parameters).fetchall()
    finally:
        connection.close()
    return [row_to_record(row) for row in rows]


def fetch_record(record_id: int) -> dict[str, Any] | None:
    connection = get_db()
    try:
        row = connection.execute(
            RECORD_SELECT + " WHERE id = ?", (record_id,)
        ).fetchone()
    finally:
        connection.close()
    return row_to_record(row) if row else None


def template_values(record: Mapping[str, Any]) -> dict[str, Any]:
    measured_at = str(record.get("measured_at", ""))
    return {
        "high_pressure": record.get("high_pressure", ""),
        "low_pressure": record.get("low_pressure", ""),
        "pulse": record.get("pulse", ""),
        "arm": record.get("arm", "left"),
        "measured_at": measured_at.replace(" ", "T")[:16],
        "note": record.get("note", ""),
    }


@app.get("/")
@app.get("/index.html")
def home() -> ResponseReturnValue:
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/result.html")
def result_page() -> ResponseReturnValue:
    return send_from_directory(BASE_DIR, "result.html")


@app.get("/history.html")
def history_page() -> ResponseReturnValue:
    return send_from_directory(BASE_DIR, "history.html")


@app.post("/submit")
def submit() -> ResponseReturnValue:
    data, errors = validate_record(request.form)
    if errors:
        return jsonify({"error": "表单校验失败", "errors": errors}), 400

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    connection = get_db()
    try:
        connection.execute(
            """
            INSERT INTO blood_pressure (
                high_pressure, low_pressure, pulse, arm, measured_at,
                note, result, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data["high_pressure"],
                data["low_pressure"],
                data["pulse"],
                data["arm"],
                data["measured_at"],
                data["note"],
                data["classification"]["label"],
                now,
            ),
        )
        connection.commit()
    finally:
        connection.close()

    return redirect(
        url_for(
            "result_page",
            high=data["high_pressure"],
            low=data["low_pressure"],
            pulse=data["pulse"],
        ),
        code=303,
    )


@app.route("/edit/<int:record_id>", methods=["GET", "POST"])
def edit_record(record_id: int) -> ResponseReturnValue:
    record = fetch_record(record_id)
    if record is None:
        abort(404)
    assert record is not None

    if request.method == "GET":
        return render_template(
            "edit.html",
            record_id=record_id,
            values=template_values(record),
            errors={},
        )

    data, errors = validate_record(request.form)
    if errors:
        return (
            render_template(
                "edit.html",
                record_id=record_id,
                values=template_values(request.form),
                errors=errors,
            ),
            400,
        )

    connection = get_db()
    try:
        cursor = connection.execute(
            """
            UPDATE blood_pressure
            SET high_pressure = ?, low_pressure = ?, pulse = ?, arm = ?,
                measured_at = ?, note = ?, result = ?
            WHERE id = ?
            """,
            (
                data["high_pressure"],
                data["low_pressure"],
                data["pulse"],
                data["arm"],
                data["measured_at"],
                data["note"],
                data["classification"]["label"],
                record_id,
            ),
        )
        connection.commit()
    finally:
        connection.close()

    if cursor.rowcount == 0:
        abort(404)
    return redirect(url_for("history_page"), code=303)


@app.post("/delete/<int:record_id>")
def delete_record(record_id: int) -> ResponseReturnValue:
    connection = get_db()
    try:
        cursor = connection.execute(
            "DELETE FROM blood_pressure WHERE id = ?", (record_id,)
        )
        connection.commit()
    finally:
        connection.close()

    if cursor.rowcount == 0:
        return jsonify({"error": "记录不存在或已被删除"}), 404
    return Response(status=204)


@app.get("/api/records")
def api_records() -> ResponseReturnValue:
    raw_days = request.args.get("days", "30").strip().lower()
    if raw_days == "all":
        days = None
    else:
        try:
            days = int(raw_days)
        except ValueError:
            return jsonify({"error": "days 必须是正整数或 all"}), 400
        if not 1 <= days <= 3650:
            return jsonify({"error": "days 需在 1–3650 之间"}), 400
    return jsonify(fetch_records(days))


@app.get("/api/stats")
def api_stats() -> ResponseReturnValue:
    records = fetch_records()
    now = datetime.now()

    def in_recent_days(record: Mapping[str, Any], days: int) -> bool:
        try:
            measured_at = datetime.fromisoformat(str(record["measured_at"]))
        except (TypeError, ValueError):
            return False
        return measured_at >= now - timedelta(days=days)

    last7 = [record for record in records if in_recent_days(record, 7)]
    last30 = [record for record in records if in_recent_days(record, 30)]

    def average(items: list[dict[str, Any]]) -> dict[str, int] | None:
        if not items:
            return None
        return {
            "high": round(
                sum(item["high_pressure"] for item in items) / len(items)
            ),
            "low": round(sum(item["low_pressure"] for item in items) / len(items)),
        }

    high_count = sum(
        record["level"] in {"grade1", "grade2", "grade3"}
        for record in last30
    )
    return jsonify(
        {
            "latest": records[0] if records else None,
            "avg7": average(last7),
            "highRatio30": high_count / len(last30) if last30 else 0,
            "total": len(records),
        }
    )


@app.post("/api/insight")
def api_insight() -> ResponseReturnValue:
    records = fetch_records(30)
    if not records:
        return jsonify({"text": "近 30 天暂无记录，持续记录后才能生成趋势解读。"})

    count = len(records)
    average_high = round(sum(r["high_pressure"] for r in records) / count)
    average_low = round(sum(r["low_pressure"] for r in records) / count)
    high_count = sum(
        r["level"] in {"grade1", "grade2", "grade3"} for r in records
    )
    highest = max(records, key=lambda r: (r["high_pressure"], r["low_pressure"]))

    trend_text = "记录数量还不足以判断升降趋势"
    if count >= 4:
        chronological = list(reversed(records))
        middle = len(chronological) // 2
        first_half = chronological[:middle]
        second_half = chronological[middle:]
        first_average = sum(r["high_pressure"] for r in first_half) / len(first_half)
        second_average = sum(r["high_pressure"] for r in second_half) / len(second_half)
        change = round(second_average - first_average)
        if change >= 3:
            trend_text = f"后半段平均收缩压较前半段上升约 {change} mmHg"
        elif change <= -3:
            trend_text = f"后半段平均收缩压较前半段下降约 {abs(change)} mmHg"
        else:
            trend_text = "前后半段平均收缩压总体平稳"

    text = (
        f"近 30 天共记录 {count} 次，平均血压约为 {average_high}/{average_low} mmHg；"
        f"其中 {high_count} 次达到 1 级高血压及以上。{trend_text}。"
        f"最高收缩压为 {highest['high_pressure']} mmHg"
        f"（{highest['measured_at']}）。建议尽量在固定时间、同一侧手臂持续测量；"
        "若血压连续偏高或伴有不适，请及时咨询医生。本内容仅作数据趋势参考，不构成医疗诊断。"
    )
    return jsonify({"text": text})


def csv_safe(value: Any) -> Any:
    """Prevent spreadsheet software from evaluating user text as a formula."""
    if not isinstance(value, str):
        return value
    if value.startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


@app.get("/export")
def export_records() -> ResponseReturnValue:
    records = fetch_records()
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(
        [
            "编号",
            "测量时间",
            "收缩压(mmHg)",
            "舒张压(mmHg)",
            "脉搏(次/分)",
            "测量部位",
            "分级",
            "备注",
        ]
    )
    for record in records:
        writer.writerow(
            [
                record["id"],
                record["measured_at"],
                record["high_pressure"],
                record["low_pressure"],
                record["pulse"] if record["pulse"] is not None else "",
                "右臂" if record["arm"] == "right" else "左臂",
                record["result"],
                csv_safe(record["note"]),
            ]
        )

    filename = f"blood_pressure_records_{datetime.now():%Y%m%d}.csv"
    response = Response("\ufeff" + output.getvalue(), content_type="text/csv; charset=utf-8")
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


# Initialize on import as well as when run directly, so `flask --app tracker run`
# and WSGI servers receive a ready database.
init_db()


if __name__ == "__main__":
    app.run(debug=True)
