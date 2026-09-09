/* =========================================================
 * 2048 小游戏 —— script.js
 * 职责：游戏逻辑 + 画面更新
 * ========================================================= */

// 棋盘大小：4 x 4
const SIZE = 4;

// ---------- 找到 HTML 里的元素（按 id 找） ----------
const board = document.getElementById('board');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const overlayBtn = document.getElementById('overlayBtn');
const newGameBtn = document.getElementById('newGameBtn');

// ---------- 游戏状态 ----------
let grid;                 // 逻辑棋盘：grid[行][列]，每格是 null 或 { value, id }
let tilesById = new Map();// 记录每个方块：id -> { obj, el }
let nextId = 1;           // 给每个方块发唯一编号
let score = 0;            // 当前分数
let wonShown = false;     // 是否已经弹出过"你赢了"
let busy = false;         // 动画播放中吗？（防止连按）
let moveToken = 0;        // 用来取消过期的动画收尾
let overlayMode = 'over'; // 弹窗是"赢了(win)"还是"结束(over)"
let cellEls = [];         // 16 个背景格子的 DOM
let geo = null;           // 棋盘尺寸参数（自适应屏幕）

// ---------- 计算棋盘几何参数（宽不同，格子大小就不同） ----------
function getGeo() {
  const W = board.clientWidth;                    // 棋盘实际宽度(px)
  const pad = Math.round(W * 0.02);               // 四周留白
  const gap = Math.round(W * 0.024);              // 格子之间的缝
  const cell = Math.round((W - pad * 2 - gap * (SIZE - 1)) / SIZE);
  const radius = Math.max(4, Math.round(cell * 0.06)); // 圆角大小
  return { W, pad, gap, cell, radius };
}

// 根据"行 r、列 c"算出这个格子在页面上的像素位置
function pos(r, c) {
  return {
    left: geo.pad + c * (geo.cell + geo.gap),
    top:  geo.pad + r * (geo.cell + geo.gap)
  };
}

// 重新摆放所有背景格子和数字方块（窗口大小变化时调用）
function layout() {
  geo = getGeo();
  cellEls.forEach((el, i) => {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    const p = pos(r, c);
    el.style.left = p.left + 'px';
    el.style.top = p.top + 'px';
    el.style.width = geo.cell + 'px';
    el.style.height = geo.cell + 'px';
    el.style.borderRadius = geo.radius + 'px';
  });
  tilesById.forEach(({ obj, el }) => {
    const p = pos(obj.r, obj.c);
    el.style.left = p.left + 'px';
    el.style.top = p.top + 'px';
    el.style.width = geo.cell + 'px';
    el.style.height = geo.cell + 'px';
    applyTileStyle(el, obj.value);
  });
}

// ---------- 不同数字对应的颜色 ----------
function colorOf(value) {
  const map = {
    2:    { bg: '#eee4da', fg: '#776e65' },
    4:    { bg: '#ede0c8', fg: '#776e65' },
    8:    { bg: '#f2b179', fg: '#f9f6f2' },
    16:   { bg: '#f59563', fg: '#f9f6f2' },
    32:   { bg: '#f67c5f', fg: '#f9f6f2' },
    64:   { bg: '#f65e3b', fg: '#f9f6f2' },
    128:  { bg: '#edcf72', fg: '#f9f6f2' },
    256:  { bg: '#edcc61', fg: '#f9f6f2' },
    512:  { bg: '#edc850', fg: '#f9f6f2' },
    1024: { bg: '#edc53f', fg: '#f9f6f2' },
    2048: { bg: '#edc22e', fg: '#f9f6f2' }
  };
  // 超过 2048 就用深色兜底
  return map[value] || { bg: '#3c3a32', fg: '#f9f6f2' };
}

// 数字越大，字号越小（不然放不下）
function fontOf(value) {
  const cell = geo.cell;
  if (value >= 1024) return Math.round(cell * 0.34);
  if (value >= 128)  return Math.round(cell * 0.40);
  if (value >= 16)   return Math.round(cell * 0.46);
  return Math.round(cell * 0.52);
}

// 把一个数字方块"打扮"好：底色、文字色、字号、圆角
function applyTileStyle(el, value) {
  const c = colorOf(value);
  el.style.backgroundColor = c.bg;
  el.style.color = c.fg;
  el.style.fontSize = fontOf(value) + 'px';
  el.style.borderRadius = geo.radius + 'px';
}

// ---------- 生成 16 个背景小格子（只执行一次） ----------
function createCells() {
  for (let i = 0; i < SIZE * SIZE; i++) {
    const el = document.createElement('div');
    el.className = 'cell';
    board.insertBefore(el, overlay); // 插到遮罩层前面
    cellEls.push(el);
  }
}

// ---------- 生成一个数字方块（带"出现"动画） ----------
function createTileEl(obj) {
  const el = document.createElement('div');
  el.className = 'tile appear';
  const p = pos(obj.r, obj.c);
  el.style.left = p.left + 'px';
  el.style.top = p.top + 'px';
  el.style.width = geo.cell + 'px';
  el.style.height = geo.cell + 'px';
  applyTileStyle(el, obj.value);
  el.textContent = obj.value;
  board.appendChild(el);
  return el;
}

// ---------- 在随机空位生成新方块：90% 是 2，10% 是 4 ----------
function addRandomTile() {
  const empty = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === null) empty.push({ r, c });
    }
  }
  if (empty.length === 0) return; // 没有空位就不加了
  const spot = empty[Math.floor(Math.random() * empty.length)];
  const obj = {
    value: Math.random() < 0.9 ? 2 : 4,
    id: nextId++
  };
  grid[spot.r][spot.c] = obj;
  obj.r = spot.r;
  obj.c = spot.c;
  const el = createTileEl(obj);
  tilesById.set(obj.id, { obj, el });
}
// ---------- 分数 ----------
function loadBest() {
  try { return Number(localStorage.getItem('2048_best')) || 0; }
  catch (e) { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem('2048_best', String(v)); }
  catch (e) { /* 忽略保存失败 */ }
}
function updateScore(add) {
  score += add;
  const best = Math.max(loadBest(), score);
  saveBest(best);
  scoreEl.textContent = score;
  bestEl.textContent = best;
}

// ---------- 核心：把一个方向的棋盘拆成 4 条"线" ----------
// 左=每一行；右=每一行反过来；上=每一列；下=每一列反过来
function buildLines(dir) {
  const lines = [];
  for (let a = 0; a < SIZE; a++) {
    const line = [];
    for (let b = 0; b < SIZE; b++) {
      let o = null;
      if (dir === 'left')  o = grid[a][b];
      if (dir === 'right') o = grid[a][SIZE - 1 - b];
      if (dir === 'up')    o = grid[b][a];
      if (dir === 'down')  o = grid[SIZE - 1 - b][a];
      if (o) o._line = a;   // 记下它原来在第几条线（动画要用）
      line.push(o);
    }
    lines.push(line);
  }
  return lines;
}

// ---------- 核心：一条线"靠边 + 合并" ----------
// 规则：相同的两个合成一个；一组只能合并一次；合并后加分
function slideLine(line) {
  const items = line.filter(o => o !== null); // 去掉空格
  const out = new Array(SIZE).fill(null);
  const merges = [];
  let idx = 0;
  for (let i = 0; i < items.length; i++) {
    const cur = items[i];
    const nxt = items[i + 1];
    if (nxt && cur.value === nxt.value) {
      cur.value *= 2;               // 合成一个更大的
      cur.finalK = idx;             // 它最终停在这一格
      nxt.finalK = idx;             // 被合并的那个也飞到同一格再消失
      out[idx] = cur;
      merges.push({ keepId: cur.id, removeId: nxt.id, value: cur.value });
      i++;                          // 跳过被合并的，保证一组只合一次
    } else {
      cur.finalK = idx;
      out[idx] = cur;
    }
    idx++;
  }
  return { out, merges };
}

// ---------- 把处理好的"线"写回棋盘（并更新每个方块的新坐标） ----------
function writeBack(dir, a, out) {
  for (let k = 0; k < SIZE; k++) {
    const o = out[k];
    if (dir === 'left')  { grid[a][k] = o; if (o) { o.r = a; o.c = k; } }
    if (dir === 'right') { grid[a][SIZE - 1 - k] = o; if (o) { o.r = a; o.c = SIZE - 1 - k; } }
    if (dir === 'up')    { grid[k][a] = o; if (o) { o.r = k; o.c = a; } }
    if (dir === 'down')  { grid[SIZE - 1 - k][a] = o; if (o) { o.r = SIZE - 1 - k; o.c = a; } }
  }
}

// 把整个棋盘拍成字符串，用来判断"这次到底动没动"
function gridSignature() {
  const arr = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      arr.push(grid[r][c] ? grid[r][c].value : 0);
  return arr.join(',');
}

// 由"线编号"换算成真正的棋盘坐标（动画要让每块飞对位置）
function rcFrom(dir, a, k) {
  if (dir === 'left')  return { r: a, c: k };
  if (dir === 'right') return { r: a, c: SIZE - 1 - k };
  if (dir === 'up')    return { r: k, c: a };
  if (dir === 'down')  return { r: SIZE - 1 - k, c: a };
}

// 当前最大数字
function highest() {
  let max = 0;
  tilesById.forEach(({ obj }) => { if (obj.value > max) max = obj.value; });
  return max;
}

// 还有没有能走的路？（有空格，或有两个相邻相同数字 = 还能玩）
function canMove() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === null) return true;
      const v = grid[r][c].value;
      if (c + 1 < SIZE && grid[r][c + 1] && grid[r][c + 1].value === v) return true;
      if (r + 1 < SIZE && grid[r + 1][c] && grid[r + 1][c].value === v) return true;
    }
  }
  return false;
}

// ---------- 执行一次移动（四大天王：左/右/上/下都走这里） ----------
function move(dir) {
  if (busy) return;                                    // 动画没放完，先不理
  if (overlay.classList.contains('show')) return;      // 弹窗显示中，先不理

  const before = gridSignature();
  const lines = buildLines(dir);
  const allMerges = [];
  let gained = 0;

  for (let a = 0; a < SIZE; a++) {
    const { out, merges } = slideLine(lines[a]);
    writeBack(dir, a, out);
    allMerges.push(...merges);
    merges.forEach(m => { gained += m.value; });
  }

  if (gridSignature() === before) return;  // 推了但没变化（撞墙了）

  busy = true;
  const token = ++moveToken;

  // ① 先让所有方块滑到新位置（CSS transition 负责播放动画）
  tilesById.forEach(({ obj, el }) => {
    const p = pos(...Object.values(rcFrom(dir, obj._line, obj.finalK)));
    el.style.left = p.left + 'px';
    el.style.top = p.top + 'px';
  });

  updateScore(gained);

  // ② 等 120ms 动画播完，再处理：合并消失、出新方块、判断输赢
  setTimeout(() => {
    if (token !== moveToken) return;  // 期间开了新游戏？这次收尾作废

    allMerges.forEach(m => {
      const keep = tilesById.get(m.keepId);
      const gone = tilesById.get(m.removeId);
      if (!keep || !gone) return;
      keep.obj.value = m.value;
      keep.el.textContent = m.value;
      keep.el.classList.remove('merged');
      void keep.el.offsetWidth;          // 强制重绘，动画才能重播
      applyTileStyle(keep.el, m.value);
      keep.el.classList.add('merged');
      gone.el.remove();                  // 被合并的方块消失
      tilesById.delete(m.removeId);
    });

    addRandomTile();                     // ③ 每次移动后补一个新方块
    busy = false;

    // ④ 判断输赢
    if (!wonShown && highest() >= 2048) {
      wonShown = true;
      showOverlay('你赢了！🎉', '成功合成 2048！', '继续挑战', 'win');
      return;
    }
    if (!canMove()) {
      showOverlay('游戏结束', '本次得分：' + score, '再来一局', 'over');
    }
  }, 120);
}

// ---------- 弹窗（胜利 / 结束） ----------
function showOverlay(title, text, btnText, mode) {
  overlayMode = mode;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlayBtn.textContent = btnText;
  overlay.classList.add('show');
}
function hideOverlay() {
  overlay.classList.remove('show');
}

// ---------- 新开一局 ----------
function newGame() {
  moveToken++;              // 取消还没执行完的动画收尾
  grid = [];
  for (let r = 0; r < SIZE; r++) {
    grid.push(new Array(SIZE).fill(null));
  }
  tilesById.forEach(({ el }) => el.remove()); // 清掉画面上所有方块
  tilesById.clear();
  nextId = 1;
  score = 0;
  wonShown = false;
  busy = false;
  hideOverlay();
  updateScore(0);
  addRandomTile();          // 开局给两个方块
  addRandomTile();
}

// ---------- 键盘：方向键 + WASD ----------
const KEY_DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right'
};
document.addEventListener('keydown', (e) => {
  const dir = KEY_DIRS[e.key];
  if (dir) {
    e.preventDefault();   // 别让方向键把页面滚走
    move(dir);
  }
});

// ---------- 按钮 ----------
newGameBtn.addEventListener('click', () => {
  newGame();
  newGameBtn.blur();      // 移开焦点，避免按空格又触发一次
});
overlayBtn.addEventListener('click', () => {
  if (overlayMode === 'win') hideOverlay(); // 赢了选"继续挑战"
  else newGame();                            // 结束就重开
  overlayBtn.blur();
});

// ---------- 手机：滑动操作 ----------
let touchStart = null;
board.addEventListener('touchstart', (e) => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
board.addEventListener('touchmove', (e) => {
  e.preventDefault();      // 滑动时别让页面跟着滚
}, { passive: false });
board.addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; // 太短不算滑动
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
  else move(dy > 0 ? 'down' : 'up');
});

// ---------- 动画结束就卸掉动画 class（下次才能重播） ----------
board.addEventListener('animationend', (e) => {
  if (e.target.classList.contains('tile')) {
    e.target.classList.remove('appear', 'merged');
  }
});

// ---------- 窗口大小变化时重新排版 ----------
window.addEventListener('resize', layout);

// ---------- 启动！ ----------
function start() {
  createCells();
  layout();
  newGame();
}
start();