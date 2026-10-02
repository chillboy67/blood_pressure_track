/* ============================================================
 * app.js  公共逻辑：血压分级 / 数据获取（失败降级 mock）/ 图表 / 表单校验
 * 依赖：mock-data.js（降级数据）；首页图表依赖 Chart.js（CDN）
 * ============================================================ */
/* ---------- 1. 血压分级（参考《中国高血压防治指南》） ----------
 * 收缩压与舒张压分别判断，取较严重的一级。
 * classifyBP(high, low) -> { level, label, color }
 * ------------------------------------------------------------- */
function classifyBP(high, low) {
  high = Number(high);
  low = Number(low);
  if (Number.isNaN(high) || Number.isNaN(low)) {
    return { level: 'unknown', label: '未知', color: 'var(--color-muted)' };
  }
  if (high < 90 || low < 60) {
    return { level: 'low', label: '低血压', color: 'var(--bp-low)' };
  }
  if (high >= 180 || low >= 110) {
    return { level: 'grade3', label: '3 级高血压', color: 'var(--bp-grade3)' };
  }
  if (high >= 160 || low >= 100) {
    return { level: 'grade2', label: '2 级高血压', color: 'var(--bp-grade2)' };
  }
  if (high >= 140 || low >= 90) {
    return { level: 'grade1', label: '1 级高血压', color: 'var(--bp-grade1)' };
  }
  if (high >= 120 || low >= 80) {
    return { level: 'high-normal', label: '正常高值', color: 'var(--bp-high-normal)' };
  }
  return { level: 'normal', label: '正常', color: 'var(--bp-normal)' };
}
/* 各级别对应的健康提示语 */
const LEVEL_TIPS = {
  'low': '本次血压偏低。起身时请放缓动作、注意补充水分；若经常头晕乏力，建议咨询医生。',
  'normal': '本次血压正常，请继续保持规律作息、均衡饮食和适度运动。',
  'high-normal': '本次血压处于正常高值。建议少盐少油、控制体重、坚持运动，并保持规律监测。',
  'grade1': '本次血压达到 1 级高血压。建议改善生活方式并连续监测一周，若持续偏高请就医咨询。',
  'grade2': '本次血压达到 2 级高血压。建议尽快就医，遵医嘱进行血压管理，避免剧烈运动和情绪波动。',
  'grade3': '本次血压达到 3 级高血压。请立即休息、避免激动，并尽快前往医院就诊。'
};
/* ---------- 2. 通用工具 ---------- */
/* 解析 "2026-10-01 08:30" 格式时间 */
function parseMeasuredAt(s) {
  if (!s) return new Date(0);
  return new Date(String(s).replace(' ', 'T'));
}
/* 展示用时间格式：10-01 08:30 */
function fmtTime(s, withYear) {
  const d = parseMeasuredAt(s);
  if (isNaN(d)) return s || '-';
  const p = n => String(n).padStart(2, '0');
  const date = `${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return (withYear ? `${d.getFullYear()}-` : '') + `${date} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
/* 分级标签 HTML（颜色 + 文字，不只靠颜色区分） */
function bpBadge(cls) {
  return `<span class="bp-badge lv-${cls.level}"><span class="bp-dot"></span>${cls.label}</span>`;
}
/* 手臂字段翻译 */
function armLabel(arm) {
  return arm === 'right' ? '右臂' : '左臂';
}
/* 转义来自记录的数据，避免备注等用户输入被当作 HTML 执行 */
function escapeHtml(value) {
  const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => escapes[ch]);
}
/* fetch 封装：任何失败（网络错误/非 2xx/非 JSON）返回 null，由调用方降级 */
async function fetchJson(url, options) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}
/* Toast 轻提示 */
let toastTimer = null;
function showToast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
/* ---------- 3. 数据获取（接口优先，失败降级 mock-data.js） ---------- */
async function getRecords(days) {
  const query = days == null ? '' : `?days=${encodeURIComponent(days)}`;
  const data = await fetchJson(`/api/records${query}`);
  if (Array.isArray(data)) return data;
  return (window.MOCK_RECORDS || []).slice();
}
/* 由记录数组本地计算统计（/api/stats 不可用时的降级算法） */
function computeStats(records) {
  const sorted = records.slice().sort((a, b) => parseMeasuredAt(b.measured_at) - parseMeasuredAt(a.measured_at));
  const latest = sorted[0] || null;
  const now = Date.now();
  const within = n => sorted.filter(r => now - parseMeasuredAt(r.measured_at).getTime() <= n * 864e5);
  const last7 = within(7);
  const last30 = within(30);
  const avg = arr => arr.length ? {
    high: Math.round(arr.reduce((s, r) => s + Number(r.high_pressure), 0) / arr.length),
    low: Math.round(arr.reduce((s, r) => s + Number(r.low_pressure), 0) / arr.length)
  } : null;
  const highCount = last30.filter(r =>
    ['grade1', 'grade2', 'grade3'].includes(classifyBP(r.high_pressure, r.low_pressure).level)
  ).length;
  return {
    latest: latest,
    avg7: avg(last7),
    highRatio30: last30.length ? highCount / last30.length : 0,
    total: records.length
  };
}
async function getStats(records) {
  const data = await fetchJson('/api/stats');
  if (data && typeof data === 'object') return data;
  return computeStats(records || await getRecords(30));
}
/* ---------- 4. 首页 ---------- */
async function initIndex() {
  const records = await getRecords(30);
  const stats = await getStats(records);
  renderStatsCards(stats);
  renderRecentList(records);
  setupTrendChart(records);
  setupBpForm();
  setupInsight();
}
function renderStatsCards(stats) {
  const latestEl = document.getElementById('stat-latest');
  const avg7El = document.getElementById('stat-avg7');
  const ratioEl = document.getElementById('stat-ratio');
  const totalEl = document.getElementById('stat-total');
  if (!latestEl) return;
  if (stats.latest) {
    const cls = classifyBP(stats.latest.high_pressure, stats.latest.low_pressure);
    latestEl.innerHTML =
      `<div class="stat-value">${stats.latest.high_pressure} / ${stats.latest.low_pressure}<span class="unit">mmHg</span></div>` +
      `<div class="stat-extra">${bpBadge(cls)} &nbsp;${fmtTime(stats.latest.measured_at)}</div>`;
  } else {
    latestEl.innerHTML = `<div class="stat-value">--</div><div class="stat-extra">暂无数据</div>`;
  }
  avg7El.innerHTML = stats.avg7
    ? `<div class="stat-value">${stats.avg7.high} / ${stats.avg7.low}<span class="unit">mmHg</span></div><div class="stat-extra">收缩压 / 舒张压均值</div>`
    : `<div class="stat-value">--</div><div class="stat-extra">近 7 天暂无数据</div>`;
  ratioEl.innerHTML =
    `<div class="stat-value">${Math.round((stats.highRatio30 || 0) * 100)}<span class="unit">%</span></div>` +
    `<div class="stat-extra">达到 1 级高血压及以上的记录占比</div>`;
  totalEl.innerHTML =
    `<div class="stat-value">${stats.total || 0}<span class="unit">条</span></div>` +
    `<div class="stat-extra">坚持记录，趋势更准</div>`;
}
function renderRecentList(records) {
  const ul = document.getElementById('recent-list');
  if (!ul) return;
  const sorted = records.slice().sort((a, b) => parseMeasuredAt(b.measured_at) - parseMeasuredAt(a.measured_at));
  const top5 = sorted.slice(0, 5);
  if (!top5.length) {
    ul.innerHTML = `<li style="justify-content:center;color:var(--color-muted)">暂无记录，先录入一条吧</li>`;
    return;
  }
  ul.innerHTML = top5.map(r => {
    const cls = classifyBP(r.high_pressure, r.low_pressure);
    return `<li>
      <span class="recent-time">${fmtTime(r.measured_at)}</span>
      <span class="recent-bp">${r.high_pressure} / ${r.low_pressure}<span class="unit"> mmHg</span></span>
      ${r.pulse ? `<span class="recent-pulse">脉搏 ${r.pulse}</span>` : ''}
      ${bpBadge(cls)}
    </li>`;
  }).join('');
}
/* 趋势折线图：收缩压/舒张压 + 140/90 参考虚线，支持 7/30 天切换 */
let trendChart = null;
let trendRecords = [];
let trendDays = 30;
function setupTrendChart(records) {
  const canvas = document.getElementById('bp-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  trendRecords = records;
  document.querySelectorAll('.chart-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      trendDays = Number(btn.dataset.days) || 30;
      drawTrendChart();
    });
  });
  /* 系统深色模式切换时重画，保证坐标颜色可读 */
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawTrendChart);
  drawTrendChart();
}
function drawTrendChart() {
  const canvas = document.getElementById('bp-chart');
  const emptyEl = document.getElementById('chart-empty');
  if (!canvas || typeof Chart === 'undefined') return;
  const css = name => getComputedStyle(document.body).getPropertyValue(name).trim();
  const sorted = trendRecords.slice().sort((a, b) => parseMeasuredAt(a.measured_at) - parseMeasuredAt(b.measured_at));
  const cutoff = Date.now() - trendDays * 864e5;
  const data = sorted.filter(r => parseMeasuredAt(r.measured_at).getTime() >= cutoff);
  if (emptyEl) emptyEl.classList.toggle('show', data.length === 0);
  const labels = data.map(r => fmtTime(r.measured_at));
  const sys = data.map(r => Number(r.high_pressure));
  const dia = data.map(r => Number(r.low_pressure));
  const refHigh = data.map(() => 140);
  const refLow = data.map(() => 90);
  const cfg = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '收缩压',
          data: sys,
          borderColor: css('--color-primary') || '#2a9d8f',
          backgroundColor: css('--color-primary') || '#2a9d8f',
          tension: .35, borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 5
        },
        {
          label: '舒张压',
          data: dia,
          borderColor: '#7c9ef8',
          backgroundColor: '#7c9ef8',
          tension: .35, borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 5
        },
        {
          label: '140 参考线',
          data: refHigh,
          borderColor: 'rgba(214, 69, 69, .55)',
          borderDash: [6, 5], borderWidth: 1.5,
          pointRadius: 0, pointHoverRadius: 0, fill: false
        },
        {
          label: '90 参考线',
          data: refLow,
          borderColor: 'rgba(232, 131, 58, .55)',
          borderDash: [6, 5], borderWidth: 1.5,
          pointRadius: 0, pointHoverRadius: 0, fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: css('--color-muted'),
            usePointStyle: true,
            filter: item => !item.text.includes('参考线')
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ctx.dataset.label.includes('参考线')
              ? null
              : `${ctx.dataset.label}: ${ctx.parsed.y} mmHg`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: css('--color-muted'), maxTicksLimit: 10 },
          grid: { color: 'transparent' }
        },
        y: {
          suggestedMin: 40,
          suggestedMax: 200,
          ticks: { color: css('--color-muted') },
          grid: { color: css('--color-border') }
        }
      }
    }
  };
  if (trendChart) { trendChart.destroy(); }
  trendChart = new Chart(canvas, cfg);
}
/* 录入表单：默认当前时间 + 前端校验 + 提交 */
function setupBpForm() {
  const form = document.getElementById('bp-form');
  if (!form) return;
  /* 测量时间默认当前时间（datetime-local 格式） */
  const timeInput = form.elements['measured_at'];
  const now = new Date();
  const p = n => String(n).padStart(2, '0');
  timeInput.value = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`;
  const setErr = (name, msg) => {
    const input = form.elements[name];
    const err = document.getElementById('err-' + name);
    if (err) {
      err.textContent = msg || '';
      err.classList.toggle('show', !!msg);
    }
    if (input) input.classList.toggle('invalid', !!msg);
  };
  /* 输入时清除对应错误 */
  ['high_pressure', 'low_pressure', 'pulse', 'note'].forEach(name => {
    const input = form.elements[name];
    if (input) input.addEventListener('input', () => setErr(name, ''));
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let ok = true;
    const high = form.elements['high_pressure'].value.trim();
    const low = form.elements['low_pressure'].value.trim();
    const pulse = form.elements['pulse'].value.trim();
    const note = form.elements['note'].value.trim();
    if (!high) { setErr('high_pressure', '请填写收缩压'); ok = false; }
    else if (Number(high) < 60 || Number(high) > 260) { setErr('high_pressure', '收缩压需在 60–260 mmHg 之间'); ok = false; }
    if (!low) { setErr('low_pressure', '请填写舒张压'); ok = false; }
    else if (Number(low) < 30 || Number(low) > 160) { setErr('low_pressure', '舒张压需在 30–160 mmHg 之间'); ok = false; }
    if (ok && Number(high) <= Number(low)) {
      setErr('low_pressure', '收缩压需大于舒张压，请检查输入');
      ok = false;
    }
    if (pulse && (Number(pulse) < 30 || Number(pulse) > 220)) {
      setErr('pulse', '脉搏需在 30–220 次/分之间');
      ok = false;
    }
    if (note.length > 100) {
      setErr('note', '备注最多 100 字');
      ok = false;
    }
    if (!ok) return;
    /* 校验通过：优先提交给 Flask 后端；后端不可用时进入演示流程 */
    const resultUrl = `result.html?high=${encodeURIComponent(high)}&low=${encodeURIComponent(low)}` +
      (pulse ? `&pulse=${encodeURIComponent(pulse)}` : '');
    try {
      const res = await fetch(form.action || '/submit', { method: 'POST', body: new FormData(form) });
      if (res.ok) {
        location.href = res.redirected ? res.url : resultUrl;
        return;
      }
      /* 静态预览服务器没有该路由，保留演示降级；真实后端错误则展示并停留在表单。 */
      if (res.status === 404 || res.status === 405) throw new Error('backend unavailable');
      const payload = await res.json().catch(() => null);
      if (payload && payload.errors) {
        Object.entries(payload.errors).forEach(([name, message]) => setErr(name, message));
      }
      showToast((payload && payload.error) || '保存失败，请检查输入后重试');
    } catch (err) {
      showToast('演示模式：后端未连接，即将展示本次测量结果');
      setTimeout(() => { location.href = resultUrl; }, 900);
    }
  });
}
/* 趋势解读：点击 -> 加载动画 -> 接口/模拟文案 */
function setupInsight() {
  const btn = document.getElementById('insight-btn');
  const text = document.getElementById('insight-text');
  if (!btn || !text) return;
  let loading = false;
  btn.addEventListener('click', async () => {
    if (loading) return;
    loading = true;
    btn.disabled = true;
    text.classList.remove('placeholder');
    text.innerHTML = `<span class="spinner"></span>正在分析近期血压趋势…`;
    const data = await fetchJson('/api/insight', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const fallback = () => new Promise(r => setTimeout(r, 800)); /* 演示时保留加载感 */
    if (data && data.text) {
      text.textContent = data.text;
    } else {
      await fallback();
      text.textContent = (window.MOCK_INSIGHT && window.MOCK_INSIGHT.text) || '暂无解读。';
    }
    btn.disabled = false;
    btn.textContent = '重新解读';
    loading = false;
  });
}
/* ---------- 5. 结果页 ---------- */
function initResult() {
  const params = new URLSearchParams(location.search);
  let high = params.get('high');
  let low = params.get('low');
  let pulse = params.get('pulse');
  let metaText = '';
  if (!high || !low) {
    /* 无参数时降级为模拟数据最新一条 */
    const latest = (window.MOCK_RECORDS || []).slice()
      .sort((a, b) => parseMeasuredAt(b.measured_at) - parseMeasuredAt(a.measured_at))[0];
    if (!latest) return;
    high = latest.high_pressure;
    low = latest.low_pressure;
    pulse = latest.pulse;
    metaText = `演示数据 · 测量时间 ${fmtTime(latest.measured_at, true)} · ${armLabel(latest.arm)}`;
  }
  const cls = classifyBP(high, low);
  document.getElementById('result-high').textContent = high;
  document.getElementById('result-low').textContent = low;
  document.getElementById('result-pulse').textContent = pulse || '--';
  document.getElementById('result-badge').innerHTML = bpBadge(cls);
  document.getElementById('result-tip').textContent = LEVEL_TIPS[cls.level] || '';
  if (metaText) document.getElementById('result-meta').textContent = metaText;
}
/* ---------- 6. 历史页 ---------- */
const historyState = { records: [], filtered: [] };
async function initHistory() {
  historyState.records = (await getRecords('all'))
    .sort((a, b) => parseMeasuredAt(b.measured_at) - parseMeasuredAt(a.measured_at)); /* 默认时间倒序 */
  ['filter-from', 'filter-to', 'filter-level'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyHistoryFilters);
  });
  const resetBtn = document.getElementById('filter-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    document.getElementById('filter-from').value = '';
    document.getElementById('filter-to').value = '';
    document.getElementById('filter-level').value = '';
    applyHistoryFilters();
  });
  /* 删除（事件委托） */
  const tbody = document.getElementById('records-body');
  if (tbody) tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-delete');
    if (!btn) return;
    const id = btn.dataset.id;
    const rec = historyState.records.find(r => String(r.id) === String(id));
    if (!rec) return;
    if (!confirm(`确定删除 ${fmtTime(rec.measured_at, true)} 的这条记录吗？`)) return;
    let realDeleted = false;
    let demoDeleted = false;
    try {
      const res = await fetch(`/delete/${id}`, { method: 'POST' });
      if (res.ok) {
        realDeleted = true;
      } else {
        const isJson = (res.headers.get('content-type') || '').includes('application/json');
        if (res.status === 404 && !isJson) {
          demoDeleted = true; /* 静态预览服务器 */
        } else {
          const payload = isJson ? await res.json().catch(() => null) : null;
          showToast((payload && payload.error) || '删除失败，请稍后重试');
          return;
        }
      }
    } catch (err) {
      demoDeleted = true;
    }
    if (!realDeleted && !demoDeleted) return;
    historyState.records = historyState.records.filter(r => String(r.id) !== String(id));
    applyHistoryFilters();
    showToast(realDeleted ? '记录已删除' : '演示模式：记录未真正删除');
  });
  applyHistoryFilters();
}
function applyHistoryFilters() {
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const level = document.getElementById('filter-level').value;
  if (from && to && from > to) {
    showToast('开始日期不能晚于结束日期，请调整');
    return;
  }
  historyState.filtered = historyState.records.filter(r => {
    const d = parseMeasuredAt(r.measured_at);
    const p = n => String(n).padStart(2, '0');
    const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (level && classifyBP(r.high_pressure, r.low_pressure).level !== level) return false;
    return true;
  });
  renderHistoryTable();
}
function renderHistoryTable() {
  const tbody = document.getElementById('records-body');
  const empty = document.getElementById('records-empty');
  const count = document.getElementById('records-count');
  if (!tbody) return;
  const list = historyState.filtered;
  if (count) count.textContent = `共 ${list.length} 条`;
  if (empty) empty.classList.toggle('show', list.length === 0);
  tbody.innerHTML = list.map(r => {
    const cls = classifyBP(r.high_pressure, r.low_pressure);
    const safeNote = escapeHtml(r.note || '');
    return `<tr>
      <td data-label="测量时间">${fmtTime(r.measured_at, true)}</td>
      <td data-label="收缩压"><span class="num">${r.high_pressure}</span> mmHg</td>
      <td data-label="舒张压"><span class="num">${r.low_pressure}</span> mmHg</td>
      <td data-label="脉搏">${r.pulse ? `<span class="num">${r.pulse}</span> 次/分` : '--'}</td>
      <td data-label="部位">${armLabel(r.arm)}</td>
      <td data-label="分级">${bpBadge(cls)}</td>
      <td data-label="备注" class="note-cell" title="${safeNote}">${safeNote || '--'}</td>
      <td data-label="操作">
        <span class="row-actions">
          <a class="btn btn-ghost btn-sm" href="/edit/${r.id}">编辑</a>
          <button type="button" class="btn btn-danger btn-sm btn-delete" data-id="${r.id}">删除</button>
        </span>
      </td>
    </tr>`;
  }).join('');
}
/* ---------- 7. 启动：导航高亮 + 按页面初始化 ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  document.querySelectorAll('[data-nav]').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === page);
  });
  if (page === 'index') initIndex();
  else if (page === 'result') initResult();
  else if (page === 'history') initHistory();
});
