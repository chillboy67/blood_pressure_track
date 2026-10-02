// 构建脚本：将纯静态页面拷贝到 dist/（无需任何编译，保持纯 HTML/CSS/JS 交付）
const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'static'), { recursive: true });
for (const f of ['index.html', 'result.html', 'history.html']) {
  fs.copyFileSync(path.join(__dirname, f), path.join(dist, f));
}
for (const f of ['style.css', 'app.js', 'mock-data.js']) {
  fs.copyFileSync(path.join(__dirname, 'static', f), path.join(dist, 'static', f));
}
console.log('build ok -> dist/ (index.html / result.html / history.html / static/*)');
