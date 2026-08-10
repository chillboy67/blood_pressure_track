# blood_pressure_track

A simple web application for recording, analyzing, and tracking blood pressure levels. Built with Python (Flask) and SQLite, it covers a complete flow of data input, evaluation, storage, and history display.

This project was created as a Python course assignment.

---

## Features

1. **Blood Pressure Input**  
   Enter systolic (high) and diastolic (low) values.

2. **Real-time Analysis**  
   Classifies readings as **Normal** or **High Blood Pressure** using common thresholds:
   - Systolic ≥ 140, or
   - Diastolic ≥ 90

3. **Storage & History**  
   Saves each submission to SQLite with a timestamp, and lists past records on the home page.

---

## Technologies Used

| Layer | Technology |
|-------|------------|
| Backend | Python + Flask |
| Database | SQLite (`data.db`) |
| Frontend | HTML (generated via `render_template_string`) |

---

## Project Structure

```
blood_pressure_track/
├── tracker.py    # App entry: routes, evaluation logic, database I/O
└── README.md
```

The local database file `data.db` is created automatically on first run.

---

## Setup and Installation

### 1. Clone the repository

```bash
git clone https://github.com/chillboy67/blood_pressure_track.git
cd blood_pressure_track
```

### 2. Create a virtual environment (recommended)

```bash
python -m venv env
source env/bin/activate   # Windows: env\Scripts\activate
```

### 3. Install dependencies

```bash
pip install flask
```

### 4. Run the application

```bash
python tracker.py
```

### 5. Open in browser

Visit: <http://127.0.0.1:5000/>

---

## How to Use

1. On the home page, enter **High Pressure** (systolic) and **Low Pressure** (diastolic).
2. Click **Submit** to see the evaluation result and timestamp.
3. Return to the home page to review all historical records.

---

## Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Input form + history list |
| `/submit` | POST | Evaluate reading, save to DB, show result |

Key pieces in `tracker.py`:

- `init_db()` — create the table if needed  
- `check_hypertension(high, low)` — apply thresholds and return the result  
- `home` / `submit` — page rendering and form handling  

---

## Database Schema

Table: `blood_pressure` (file: `data.db`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `high_pressure` | INTEGER | Systolic value |
| `low_pressure` | INTEGER | Diastolic value |
| `result` | TEXT | Evaluation result |
| `timestamp` | TEXT | Time of submission |

---

## Troubleshooting

**Database file missing**  
`data.db` is created by `init_db()` on first launch. If creation fails, check write permissions in the working directory.

**Port already in use**  
Default port is `5000`. Stop the process using that port, or change the port in `app.run`.

**Dependencies not installed**  
Activate your virtual environment and run `pip install flask`.

---

## Disclaimer

The blood pressure rules in this app are for learning and demonstration only. They are not a medical diagnosis. Seek professional care if you have health concerns.

---

## Author

- **chillboy67** — [GitHub](https://github.com/chillboy67)

---

## License

MIT License. Free to use, modify, and distribute.

---
---

# blood_pressure_track（中文）

基于 Flask 与 SQLite 的血压记录与追踪 Web 应用。可录入收缩压 / 舒张压，按常用阈值判断是否偏高，并将结果与时间戳持久化保存，方便在首页查看历史记录。

本项目为 Python 课程作业，用于练习 Web 开发、数据库读写与表单交互的完整流程。

---

## 功能

1. **血压录入**  
   输入收缩压（高压）与舒张压（低压）。

2. **即时判断**  
   根据常用阈值给出 **Normal（正常）** 或 **High Blood Pressure（偏高）** 结果：
   - 收缩压 ≥ 140，或
   - 舒张压 ≥ 90

3. **存储与历史**  
   每次提交写入 SQLite，并在首页展示历史记录（数值、判断结果、时间）。

---

## 技术栈

| 部分 | 技术 |
|------|------|
| 后端 | Python + Flask |
| 数据 | SQLite（`data.db`） |
| 前端 | HTML（`render_template_string` 动态生成） |

---

## 项目结构

```
blood_pressure_track/
├── tracker.py    # 应用入口：路由、判断逻辑、数据库读写
└── README.md
```

首次运行会自动创建本地数据库文件 `data.db`。

---

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/chillboy67/blood_pressure_track.git
cd blood_pressure_track
```

### 2. 创建虚拟环境（推荐）

```bash
python -m venv env
source env/bin/activate   # Windows: env\Scripts\activate
```

### 3. 安装依赖

```bash
pip install flask
```

### 4. 启动

```bash
python tracker.py
```

### 5. 访问

浏览器打开：<http://127.0.0.1:5000/>

---

## 使用说明

1. 在首页表单填写 **High Pressure**（收缩压）与 **Low Pressure**（舒张压）。
2. 点击 **Submit**，查看本次判断结果与时间。
3. 返回首页可浏览全部历史记录。

---

## 路由说明

| 路由 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 录入表单 + 历史记录列表 |
| `/submit` | POST | 接收表单、判断血压、写入数据库并展示结果 |

核心逻辑在 `tracker.py`：

- `init_db()`：初始化表结构  
- `check_hypertension(high, low)`：按阈值返回判断结果  
- `home` / `submit`：页面展示与提交处理  

---

## 数据库表结构

表名：`blood_pressure`（文件：`data.db`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 主键，自增 |
| `high_pressure` | INTEGER | 收缩压 |
| `low_pressure` | INTEGER | 舒张压 |
| `result` | TEXT | 判断结果 |
| `timestamp` | TEXT | 录入时间 |

---

## 常见问题

**数据库文件不存在**  
首次启动时会由 `init_db()` 自动创建 `data.db`。若异常，检查当前工作目录写权限。

**端口被占用**  
默认使用 `5000`。可先结束占用进程，或在代码中修改 `app.run` 的端口参数。

**依赖未安装**  
确认已激活虚拟环境，并执行 `pip install flask`。

---

## 说明

本工具中的血压判断规则仅作学习与演示，不能替代医学诊断。如有健康疑虑，请咨询专业医疗机构。

---

## 作者

- **chillboy67** — [GitHub](https://github.com/chillboy67)

---

## 许可证

MIT License。可自由使用、修改与分发。
