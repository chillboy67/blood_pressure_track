# 血压记录与追踪

[English](./README.md) | **中文**

一个基于 Flask、SQLite 和原生 HTML/CSS/JavaScript 的血压记录应用，支持录入、分级、趋势、统计、编辑、删除与 CSV 导出。

> 本项目用于课程学习与个人数据记录，不提供医疗诊断。若血压连续异常或伴有不适，请咨询专业医生。

## 功能

- 记录收缩压、舒张压、脉搏、测量部位、测量时间与备注
- 按六个级别展示血压状态：低血压、正常、正常高值、1/2/3 级高血压
- 首页展示最近记录、7 天平均值、30 天偏高占比和趋势图
- 自动生成基于近 30 天数据的规则化趋势解读
- 历史记录按日期和分级筛选，默认按测量时间倒序
- 编辑、删除已有记录
- 导出 UTF-8 CSV，并防止备注内容触发电子表格公式
- 自动迁移旧版 SQLite 表，不丢失原有记录
- 后端不可用时，静态前端仍可使用 Mock 数据预览

## 后端设计

- 使用 `create_app()` 应用工厂，可为测试或部署传入独立配置
- SQLite 连接保存在 Flask `g` 中，同一请求复用并在上下文结束时统一关闭
- 应用创建时自动执行数据库初始化和旧表迁移，`flask --app tracker run` 也可安全启动
- 服务端统一校验数字格式、范围、收缩压与舒张压关系、日期、测量部位和备注长度
- 动态编辑页位于 `templates/edit.html`，由 Jinja 自动转义用户输入；其余页面是不插入用户数据的静态文件
- 默认启动不启用调试模式，开发时需要显式传入 `--debug`
- 数据库路径可以通过 `BLOOD_PRESSURE_DATABASE` 环境变量覆盖
- `/health` 可用于部署健康检查

## 技术栈

| 部分 | 技术 |
|---|---|
| 后端 | Python 3 + Flask 3 |
| 数据库 | SQLite |
| 前端 | 原生 HTML / CSS / JavaScript、Chart.js |
| 测试 | Python `unittest` + Flask Test Client |
| 持续集成 | GitHub Actions |

## 项目结构

```text
blood_pressure_track/
├── .github/workflows/
│   └── tests.yml            # 自动测试与构建检查
├── tracker.py               # 应用工厂、路由、校验、数据库与 API
├── index.html               # 首页和录入表单
├── result.html              # 测量结果页
├── history.html             # 历史记录页
├── templates/
│   └── edit.html            # Flask 编辑页模板
├── static/
│   ├── app.js               # 前端交互与 API 对接
│   ├── style.css
│   └── mock-data.js         # 静态预览降级数据
├── tests/
│   └── test_tracker.py      # 后端回归测试
├── requirements.txt
└── data.db                  # 首次运行自动创建（已忽略提交）
```

## 快速开始

```bash
python3 -m venv env
source env/bin/activate        # Windows: env\Scripts\activate
python -m pip install -r requirements.txt
python tracker.py
```

浏览器打开：<http://127.0.0.1:5000/>

`python tracker.py` 不会启用调试模式。如需本地调试：

```bash
flask --app tracker run --debug
```

必须通过 Flask 的 `5000` 端口使用完整功能。`npm run dev` 只用于静态前端预览，写入、编辑、删除和导出不会真正持久化。

### 自定义数据库位置

```bash
BLOOD_PRESSURE_DATABASE=/absolute/path/data.db python tracker.py
```

### 手动初始化或迁移数据库

```bash
flask --app tracker init-db
```

## 接口与页面

| 路径 | 方法 | 说明 |
|---|---|---|
| `/`、`/index.html` | GET | 首页 |
| `/result.html?high=&low=&pulse=` | GET | 结果页，支持查询参数直达 |
| `/history.html` | GET | 历史记录 |
| `/health` | GET | 数据库健康检查 |
| `/submit` | POST | 新增记录 |
| `/edit/<id>` | GET / POST | 打开编辑页 / 保存修改 |
| `/delete/<id>` | POST | 删除记录 |
| `/export` | GET | 导出全部记录为 CSV |
| `/api/records?days=30` | GET | 获取指定天数记录；`days=all` 获取全部 |
| `/api/stats` | GET | 获取首页统计数据 |
| `/api/insight` | POST | 获取近 30 天趋势解读 |

`/submit` 与 `/edit/<id>` 使用以下表单字段：

- `high_pressure`：必填整数，60–260
- `low_pressure`：必填整数，30–160，且必须小于收缩压
- `pulse`：选填整数，30–220
- `arm`：`left` 或 `right`
- `measured_at`：`datetime-local` 格式，留空时使用当前时间
- `note`：选填，最多 100 字

校验失败返回 HTTP 400，不会写入数据库。

## 数据库兼容

程序创建应用时会自动执行 `init_db()`：

1. 新项目创建完整的 `blood_pressure` 表；
2. 检测旧版只有 `high_pressure`、`low_pressure`、`result`、`timestamp` 的表；
3. 自动增加 `pulse`、`arm`、`measured_at`、`note` 字段；
4. 将旧记录的 `timestamp` 迁移为测量时间；
5. 为时间倒序查询创建索引。

升级前仍建议自行备份重要的 `data.db`。

## 测试

```bash
env/bin/python -m unittest discover -s tests -v
node --check static/app.js
npm run build
```

测试使用独立应用实例和临时数据库，不会修改正式的 `data.db`。GitHub Actions 会在推送和拉取请求时自动执行测试、语法检查和静态构建一致性检查。

## 设计参考

- [Flask 官方教程 Flaskr](https://flask.palletsprojects.com/tutorial/)：应用工厂、请求级数据库连接与 CLI
- [miguelgrinberg/microblog](https://github.com/miguelgrinberg/microblog)：配置分层、扩展初始化与模块组织
- [derdilla/blood-pressure-monitor-fl](https://github.com/derdilla/blood-pressure-monitor-fl)：血压记录字段、趋势和导出功能
- [wger-project/wger](https://github.com/wger-project/wger)：数值范围校验、稳定排序、索引和回归测试
