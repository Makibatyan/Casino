/* =====================================================
   slot.js  —  借金返済スロット
   localStorage キー（home.html と共有）
     bugging_cash  : 手持ち金額
     bugging_debt  : 借金残高
     bugging_paid  : 返済済み累計
   ===================================================== */

// ─── 共有 localStorage キー ──────────────────────────
const KEY_CASH  = 'bugging_cash';
const KEY_DEBT  = 'bugging_debt';
const KEY_PAID  = 'bugging_paid';
const KEY_BET   = 'bugging_slot_bet';   // BET額はスロット専用で保存

// ─── 初期値（home.html と合わせること）─────────────
const INIT_CASH = 5000;
const INIT_DEBT = 500000;

// ─── スロット定数 ────────────────────────────────────
const SYMBOLS   = ['💎','7️⃣','🍒','🔔','🍋','🍉','🍇'];
const WEIGHTS   = [1, 3, 8, 8, 12, 12, 14];
const PAYOUTS   = {'💎':50,'7️⃣':20,'🍒':10,'🔔':7,'🍋':5,'🍉':4,'🍇':3};
const STRIP_LEN = 24;
const ITEM_H    = 110;
const SPIN_SPEED= 16;

// ─── ゲーム状態 ──────────────────────────────────────
let cash, debt, paidDebt, bet;
let spinning  = false;
let stopFlags = [false, false, false];
let stopped   = 0;
let rafIds    = [null, null, null];
let positions = [0, 0, 0];
let strips    = [[], [], []];

// ─── ユーティリティ ──────────────────────────────────
function fmt(n) {
  return '¥' + Math.abs(Math.round(n)).toLocaleString();
}

function weightedRand() {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return i;
  }
  return SYMBOLS.length - 1;
}

function makeStrip() {
  const s = [];
  for (let i = 0; i < STRIP_LEN; i++) s.push(SYMBOLS[weightedRand()]);
  return s;
}

function getVisible(col) {
  const idx = Math.round(positions[col] / ITEM_H) % strips[col].length;
  return strips[col][(idx + strips[col].length) % strips[col].length];
}

// ─── localStorage 読み書き ───────────────────────────
function loadShared() {
  try {
    return {
      cash: parseFloat(localStorage.getItem(KEY_CASH) ?? INIT_CASH),
      debt: parseFloat(localStorage.getItem(KEY_DEBT) ?? INIT_DEBT),
      paid: parseFloat(localStorage.getItem(KEY_PAID) ?? 0),
    };
  } catch (e) {
    return { cash: INIT_CASH, debt: INIT_DEBT, paid: 0 };
  }
}

function saveShared() {
  try {
    localStorage.setItem(KEY_CASH, cash);
    localStorage.setItem(KEY_DEBT, debt);
    localStorage.setItem(KEY_PAID, paidDebt);
    localStorage.setItem(KEY_BET,  bet);
  } catch (e) {}
}

// ─── UI 描画（初回のみフル描画）─────────────────────
function renderUI() {
  document.getElementById('main-content').innerHTML = `
    <div class="title-block">
      <h1>Debt Breaker</h1>
      <div class="subtitle">借金返済スロット</div>
    </div>

    <div class="story-banner">
      <strong>⚠️ 借金残高: ${fmt(debt)}</strong>
      手持ち ${fmt(cash)} を賭けて稼ぎ出せ。<br>
      ホームに戻って返済することもできる。
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">手持ち</div>
        <div class="stat-value money" id="disp-cash">${fmt(cash)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">今のBET</div>
        <div class="stat-value bet" id="disp-bet">${fmt(bet)}</div>
      </div>
    </div>

    <div class="machine">
      <div class="machine-header">
        <div class="header-line rev"></div>
        <span>🎰 SLOT MACHINE 🎰</span>
        <div class="header-line"></div>
      </div>
      <div class="reels-outer">
        <div class="reels-inner" id="reels-inner"></div>
        <div class="win-line" id="win-line"></div>
        <div class="win-overlay"><div class="win-text" id="win-text">WIN!</div></div>
      </div>
    </div>

    <div class="bet-row">
      <span class="bet-label">BET</span>
      <button class="btn-small" onclick="changeBet(-500)">－5</button>
      <button class="btn-small" onclick="changeBet(-100)">－</button>
      <div class="bet-display" id="disp-bet2">${fmt(bet)}</div>
      <button class="btn-small" onclick="changeBet(100)">＋</button>
      <button class="btn-small" onclick="changeBet(500)">+5</button>
      <button class="btn-max"   onclick="setBetMax()">MAX</button>
    </div>

    <div class="stop-row">
      <button class="btn-stop-ind" id="stop0" disabled onclick="stopReel(0)">STOP ①</button>
      <button class="btn-stop-ind" id="stop1" disabled onclick="stopReel(1)">STOP ②</button>
      <button class="btn-stop-ind" id="stop2" disabled onclick="stopReel(2)">STOP ③</button>
    </div>

    <div class="main-btn-row">
      <button class="btn-main btn-start" id="btn-start" onclick="startSpin()">START</button>
      <button class="btn-main btn-home"  onclick="goHome()">← HOME</button>
    </div>

    <div class="payout-table">
      <div class="payout-title">配当表</div>
      <div class="payout-grid">
        <div class="payout-row"><span class="payout-sym">💎💎💎</span><span class="payout-mult payout-jackpot">×50 JACKPOT</span></div>
        <div class="payout-row"><span class="payout-sym">7️⃣7️⃣7️⃣</span><span class="payout-mult">×20</span></div>
        <div class="payout-row"><span class="payout-sym">🍒🍒🍒</span><span class="payout-mult">×10</span></div>
        <div class="payout-row"><span class="payout-sym">🔔🔔🔔</span><span class="payout-mult">×7</span></div>
        <div class="payout-row"><span class="payout-sym">🍋🍋🍋</span><span class="payout-mult">×5</span></div>
        <div class="payout-row"><span class="payout-sym">🍉🍉🍉</span><span class="payout-mult">×4</span></div>
        <div class="payout-row"><span class="payout-sym">🍇🍇🍇</span><span class="payout-mult">×3</span></div>
        <div class="payout-row"><span class="payout-sym">🍒🍒 (2個)</span><span class="payout-mult">×1.5</span></div>
      </div>
    </div>

    <div class="log-area" id="log-area"></div>
  `;

  buildReels();
}

// ─── リール構築 ──────────────────────────────────────
function buildReels() {
  strips    = [makeStrip(), makeStrip(), makeStrip()];
  positions = [0, 0, 0];
  const cont = document.getElementById('reels-inner');
  if (!cont) return;
  cont.innerHTML = '';
  for (let c = 0; c < 3; c++) {
    const col   = document.createElement('div');
    col.className = 'reel-col';
    col.id      = 'reel-col-' + c;
    const strip = document.createElement('div');
    strip.className = 'reel-strip';
    strip.id    = 'reel-strip-' + c;
    [...strips[c], ...strips[c], ...strips[c]].forEach(sym => {
      const item = document.createElement('div');
      item.className   = 'reel-item';
      item.textContent = sym;
      strip.appendChild(item);
    });
    col.appendChild(strip);
    cont.appendChild(col);
  }
}

// ─── 表示更新（部分）────────────────────────────────
function updateStats() {
  const e = id => document.getElementById(id);
  if (e('disp-cash'))  e('disp-cash').textContent  = fmt(cash);
  if (e('disp-bet'))   e('disp-bet').textContent   = fmt(bet);
  if (e('disp-bet2'))  e('disp-bet2').textContent  = fmt(bet);
  if (e('btn-start'))  e('btn-start').disabled = spinning;
}

// ─── スタート ────────────────────────────────────────
function startSpin() {
  if (spinning) return;
  if (cash < bet) { addLog('⚠ 手持ちが不足しています', 'lose'); return; }

  cash -= bet;
  saveShared();
  updateStats();

  spinning  = true;
  stopFlags = [false, false, false];
  stopped   = 0;

  const wl = document.getElementById('win-line');
  const wt = document.getElementById('win-text');
  if (wl) wl.classList.remove('active');
  if (wt) { wt.classList.remove('show'); wt.textContent = 'WIN!'; }

  ['stop0','stop1','stop2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
  const sb = document.getElementById('btn-start');
  if (sb) sb.disabled = true;

  for (let c = 0; c < 3; c++) animateReel(c);
}

function animateReel(c) {
  function tick() {
    positions[c] += SPIN_SPEED;
    const total = strips[c].length * ITEM_H;
    if (positions[c] >= total * 2) positions[c] -= total;
    const s = document.getElementById('reel-strip-' + c);
    if (s) s.style.transform = `translateY(-${positions[c]}px)`;
    if (!stopFlags[c]) {
      rafIds[c] = requestAnimationFrame(tick);
    } else {
      snapReel(c);
    }
  }
  rafIds[c] = requestAnimationFrame(tick);
}

function snapReel(c) {
  positions[c] = Math.round(positions[c] / ITEM_H) * ITEM_H;
  const s = document.getElementById('reel-strip-' + c);
  if (s) s.style.transform = `translateY(-${positions[c]}px)`;
  stopped++;
  if (stopped === 3) resolveResult();
}

function stopReel(idx) {
  if (!spinning || stopFlags[idx]) return;
  stopFlags[idx] = true;
  const btn = document.getElementById('stop' + idx);
  if (btn) btn.disabled = true;
}

// ─── 結果判定 ────────────────────────────────────────
function resolveResult() {
  spinning = false;
  const syms = [getVisible(0), getVisible(1), getVisible(2)];
  let winAmt   = 0;
  let msg      = '';
  let cls      = 'lose';
  let winLabel = 'WIN!';

  if (syms[0] === syms[1] && syms[1] === syms[2]) {
    const mult = PAYOUTS[syms[0]] || 1;
    winAmt = bet * mult;
    if (syms[0] === '💎') {
      winLabel = 'JACKPOT!!'; cls = 'jackpot';
      msg = `💎 JACKPOT!! → ${fmt(winAmt)} 獲得！`;
    } else {
      winLabel = 'WIN!'; cls = 'win';
      msg = `${syms[0]}×3 → ${fmt(winAmt)} 獲得 (×${mult})`;
    }
  } else if (syms.filter(s => s === '🍒').length >= 2) {
    winAmt = Math.floor(bet * 1.5);
    cls = 'win'; winLabel = 'WIN!';
    msg = `🍒×2 → ${fmt(winAmt)} 獲得 (×1.5)`;
  } else {
    msg = `${syms.join('')} … はずれ (−${fmt(bet)})`;
  }

  // 今回のゲームでの損益（獲得額 - 賭け金）
  let netChange = winAmt - bet;

  //1.手持ちの更新
  cash += winAmt;
  //スロットのresolveResult関数内での保存処理
  let currentDiff = parseInt(localStorage.getItem("last_diff")) || 0;
  let newDiff = currentDiff + netChange;

  localStorage.setItem("last_diff", newDiff);

  if (winAmt > 0) {
    const wl = document.getElementById('win-line');
    const wt = document.getElementById('win-text');
    if (wl) wl.classList.add('active');
    if (wt) { wt.textContent = winLabel; wt.classList.add('show'); }
    setTimeout(() => {
      const wl2 = document.getElementById('win-line');
      const wt2 = document.getElementById('win-text');
      if (wl2) wl2.classList.remove('active');
      if (wt2) wt2.classList.remove('show');
    }, 2000);
  }

  addLog(msg, cls);
  saveShared();
  updateStats();

  const sb = document.getElementById('btn-start');
  if (sb) sb.disabled = false;

  if (cash <= 0) {
     // スロットのゲームオーバー画面を呼ばず、直接ホームへ移動させる
    location.href = '../home/home.html';
  }
}

// ─── BET 操作 ────────────────────────────────────────
function changeBet(delta) {
  bet = Math.max(100, Math.min(cash || INIT_CASH, bet + delta));
  saveShared();
  updateStats();
}

function setBetMax() {
  bet = Math.max(100, Math.min(cash, 10000));
  saveShared();
  updateStats();
}

// ─── HOME に戻る ─────────────────────────────────────
function goHome() {
  saveShared();
  location.href = '../home/home.html';   // フォルダ構成に合わせて変更してください　
}
// ─── ログ ────────────────────────────────────────────
function addLog(msg, cls = '') {
  const log = document.getElementById('log-area');
  if (!log) return;
  const line = document.createElement('div');
  line.className   = 'log-line ' + cls;
  line.textContent = msg;
  log.insertBefore(line, log.firstChild);
  while (log.children.length > 30) log.removeChild(log.lastChild);
}



// ─── 初期化 ──────────────────────────────────────────
function initSlot() {
  // home.html 側の shared データを読み込む
  // 初回（まだ home.html を開いていない場合）は初期値をセット
  if (localStorage.getItem(KEY_DEBT) === null) {
    localStorage.setItem(KEY_CASH, INIT_CASH);
    localStorage.setItem(KEY_DEBT, INIT_DEBT);
    localStorage.setItem(KEY_PAID, 0);
  }

  const shared = loadShared();
  cash     = shared.cash;
  debt     = shared.debt;
  paidDebt = shared.paid;
  bet      = parseFloat(localStorage.getItem(KEY_BET) || 100);
  bet      = Math.max(100, Math.min(cash, bet)); // cashを超えないよう補正

  spinning  = false;
  stopFlags = [false, false, false];
  stopped   = 0;

  renderUI();
  addLog('🎰 スロットを開始しました', 'info');
}

// ─── YouTube BGM 設定 ────────────────────────────────
let bgmPlayer;

// 1. ページ読み込み時にYouTubeのAPIスクリプトを自動でHTMLに差し込む
(function loadYoutubeAPI() {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
})();

// 2. APIの準備ができたら自動で呼ばれる関数
window.onYouTubeIframeAPIReady = function() {
  // bodyの末尾に、BGM用の隠し要素を自動作成
  const bgmDiv = document.createElement('div');
  bgmDiv.id = 'bgm-player';
  document.body.appendChild(bgmDiv);

  bgmPlayer = new YT.Player('bgm-player', {
    height: '0',
    width: '0',
    videoId: '0is4q9mlFHU', // あなたの動画ID
    playerVars: {
      'playsinline': 1,
      'loop': 1,
      'playlist': '0is4q9mlFHU'
    },
    events: {
      'onReady': (event) => {
        event.target.mute();      // 最初は音なしで再生開始
        event.target.playVideo();
      }
    }
  });
};

// 3. ユーザーが画面のどこかをクリックしたらミュートを解除する
window.addEventListener('click', () => {
  if (bgmPlayer && typeof bgmPlayer.unMute === 'function') {
    bgmPlayer.unMute();
    bgmPlayer.setVolume(30); // 音量は0〜100（スロットの邪魔にならないよう30%程度に設定）
    bgmPlayer.playVideo();
  }
}, { once: true }); // 最初の1回だけ実行

// エントリーポイント
initSlot();