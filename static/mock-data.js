/* ============================================================
 * mock-data.js  模拟数据（后端接口不可用时自动降级使用）
 * 覆盖最近 30 天（2026-09-03 ~ 2026-10-02），共 20 条，
 * 六个分级（低血压/正常/正常高值/1级/2级/3级高血压）均有样本。
 * ============================================================ */
window.MOCK_RECORDS = [
  { id: 20, high_pressure: 138, low_pressure: 88, pulse: 71, measured_at: "2026-10-02 08:15", arm: "left",  note: "早起后测量" },
  { id: 19, high_pressure: 135, low_pressure: 85, pulse: 72, measured_at: "2026-10-01 08:30", arm: "left",  note: "早饭前" },
  { id: 18, high_pressure: 146, low_pressure: 93, pulse: 76, measured_at: "2026-09-30 21:00", arm: "right", note: "晚饭后，略高" },
  { id: 17, high_pressure: 128, low_pressure: 82, pulse: 70, measured_at: "2026-09-29 08:10", arm: "left",  note: "" },
  { id: 16, high_pressure: 118, low_pressure: 76, pulse: 68, measured_at: "2026-09-28 08:20", arm: "left",  note: "状态不错" },
  { id: 15, high_pressure: 152, low_pressure: 95, pulse: 79, measured_at: "2026-09-27 22:05", arm: "right", note: "加班后测量" },
  { id: 14, high_pressure: 124, low_pressure: 79, pulse: 66, measured_at: "2026-09-26 09:00", arm: "left",  note: "" },
  { id: 13, high_pressure: 112, low_pressure: 72, pulse: 65, measured_at: "2026-09-25 08:40", arm: "left",  note: "" },
  { id: 12, high_pressure: 168, low_pressure: 106, pulse: 84, measured_at: "2026-09-24 21:30", arm: "right", note: "有点头晕" },
  { id: 11, high_pressure: 133, low_pressure: 86, pulse: 71, measured_at: "2026-09-23 08:25", arm: "left",  note: "" },
  { id: 10, high_pressure: 90,  low_pressure: 58, pulse: 62, measured_at: "2026-09-22 08:15", arm: "left",  note: "感觉有点乏力" },
  { id: 9,  high_pressure: 142, low_pressure: 91, pulse: 75, measured_at: "2026-09-21 20:50", arm: "right", note: "" },
  { id: 8,  high_pressure: 121, low_pressure: 80, pulse: 69, measured_at: "2026-09-19 08:35", arm: "left",  note: "" },
  { id: 7,  high_pressure: 116, low_pressure: 74, pulse: 67, measured_at: "2026-09-18 08:20", arm: "left",  note: "晨练后休息半小时测" },
  { id: 6,  high_pressure: 186, low_pressure: 116, pulse: 92, measured_at: "2026-09-16 21:10", arm: "right", note: "情绪激动后，需注意" },
  { id: 5,  high_pressure: 131, low_pressure: 84, pulse: 70, measured_at: "2026-09-15 08:45", arm: "left",  note: "" },
  { id: 4,  high_pressure: 149, low_pressure: 94, pulse: 77, measured_at: "2026-09-12 08:30", arm: "left",  note: "" },
  { id: 3,  high_pressure: 108, low_pressure: 70, pulse: 64, measured_at: "2026-09-10 08:15", arm: "left",  note: "" },
  { id: 2,  high_pressure: 163, low_pressure: 102, pulse: 82, measured_at: "2026-09-08 21:20", arm: "right", note: "应酬饮酒后" },
  { id: 1,  high_pressure: 126, low_pressure: 81, pulse: 68, measured_at: "2026-09-05 08:40", arm: "left",  note: "晨测" }
];
/* 趋势解读 - 模拟文案（POST /api/insight 失败时使用） */
window.MOCK_INSIGHT = {
  text: "近 30 天的记录显示，您的血压整体处于「正常高值」至「1 级高血压」区间，收缩压波动较明显，晚间测量值普遍高于清晨。期间出现过个别明显偏高的记录，建议：1）每天固定时间、同一侧手臂测量；2）减少盐分摄入、避免饮酒和熬夜；3）坚持每周 3 次以上中等强度运动；4）若连续多日收缩压 ≥ 160 或伴有头晕胸闷，请及时就医。本内容仅为数据趋势参考，不构成医疗诊断。"
};
