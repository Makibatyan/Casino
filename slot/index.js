/* =====================================================
   index.js  —  借金返済スロット
   localStorage キー（home.html と共有）
     bugging_cash  : 手持ち金額
     bugging_debt  : 借金残高
     bugging_paid  : 返済済み累計
   ===================================================== */
// ─── 効果音生成（Web Audio API） ──────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  // ブラウザのオーディオコンテキストが停止している場合は再開
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'start') {
    // スタートボタン：重みのある「ズゥン！」という音
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } 
  else if (type === 'stop') {
    // ストップボタン：カチッとした硬い金属音
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(200, now + 0.05);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  }
  else if (type === 'win') {
    // 勝利時：ピキピキピキーン！という高揚感のある音
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.1);
    osc.frequency.linearRampToValueAtTime(900, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);
  }
  else if (type === 'jackpot') {
    // 大当たり（7 or 💎）：圧倒的至福のファンファーレ風
    osc.type = 'square';
    osc.frequency.setValueAtTime(523.25, now); // ド
    osc.frequency.setValueAtTime(659.25, now + 0.1); // ミ
    osc.frequency.setValueAtTime(783.99, now + 0.2); // ソ
    osc.frequency.setValueAtTime(1046.50, now + 0.3); // ド（高）
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.6);
    osc.start(now);
    osc.stop(now + 0.6);
  }
}
   
// ─── 共有 localStorage キー ──────────────────────────
const KEY_CASH  = 'bugging_cash';
const KEY_DEBT  = 'bugging_debt';
const KEY_PAID  = 'bugging_paid';
const KEY_BET   = 'bugging_slot_bet';   // BET額はスロット専用で保存

// ─── 初期値（home.html と合わせること）─────────────
const INIT_CASH = 100000000; // 💡 所持金1億ペリカ
const INIT_DEBT = 500000000; // 💡 借金5億ペリカ（240億への布石）
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
let savedCash = localStorage.getItem(KEY_CASH);


cash = (savedCash !== null) ? parseInt(savedCash, 10) : 100000000;


if (isNaN(cash)) {
    cash = INIT_CASH;
    localStorage.setItem(KEY_CASH, cash);
}

// ─── カイジ風セリフの定義（通常時 vs 1億以上の大金持ち時） ──────────────────
const KAIJI_SLOT_LINES = {
  normal: {
    start: ["「ここから先は勝つだけだ」", "「運命は自分の手で切り開く——」"],
    spin: ["「回せっ…！うねりを出せ…！」", "「止まるな…！神よ、俺の右腕を導け…！」"],
    win: ["「勝った…！この調子だ！」", "「よしっ…！借金返済への大きな一歩…！」"],
    lose: ["「くそっ…まだ終わりじゃない」", "「次だ…次こそ必ず取り返す…！」"]
  },
  rich: { // 💡 ローカルストレージ（手持ち）が1億ペリカ以上の時
    start: ["「フフ…1億超えの大金、ここでさらに膨らませる…！」", "「金が金を呼ぶ…圧倒的悦楽の始まりだ…！」"],
    spin: ["「狂気…！1回で動くペリカが脳を焼く…！」", "「ガタガタぬかすな…！張るだけだ、全額…！」"],
    win: ["「圧倒的至福…！これぞ強運の持ち主…！」", "「ククク…計算通り、いやそれ以上…！」"],
    lose: ["「チッ…かすり傷だ。この程度のペリカ、痛くも痒くもない」", "「いいだろう…焦るな。次で全てを呑み込んでやる」"]
  }
};

// ─── ユーティリティ ──────────────────────────────────
function fmt(n) {
  // 💡 ペリカ表示に対応
  return Math.abs(Math.round(n)).toLocaleString() + 'ペリカ';
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

// ─── セリフコントロール（金額分岐付き） ──────────────────
function setKaijiLine(situation) {
  const dialogueEl = document.getElementById('kaiji-dialogue');
  if (!dialogueEl) return;

  // 1億ペリカ以上なら 'rich'、それ未満なら 'normal' を選択
  const isRich = cash >= 100000000;
  const pool = isRich ? KAIJI_SLOT_LINES.rich[situation] : KAIJI_SLOT_LINES.normal[situation];
  
  const line = pool[Math.floor(Math.random() * pool.length)];
  dialogueEl.textContent = line;
  
  // アニメーションのリセット
  dialogueEl.style.animation = "none";
  void dialogueEl.offsetWidth;
  dialogueEl.style.animation = "fadeIn 0.4s ease-out";
}

// ─── ざわざわ演出エフェクト ──────────────────────────────
function triggerZawa(count = 3) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const zawa = document.createElement('div');
      zawa.className = 'zawa-text';
      zawa.textContent = 'ざわ…';
      
      // 画面のランダムな位置に配置
      zawa.style.top = Math.random() * 80 + 10 + '%';
      zawa.style.left = Math.random() * 80 + 10 + '%';
      // サイズもランダム
      zawa.style.fontSize = Math.random() * 1.5 + 1.5 + 'rem';
      
      document.body.appendChild(zawa);
      
      // アニメーション終了後に消去
      setTimeout(() => zawa.remove(), 1500);
    }, i * 300); // 少しずつずらして出現
  }
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
// ─── タイトル画面───────────────────────────
function renderTitle() {
   document.getElementById('main-content').innerHTML = `
    <div id="titleScreen">
        <div class="title-card">
            <div class="title-game-name">DEBT BREAKER<br>SLOT</div>
            <div class="title-subtitle">―― 運命は自分の手で切り開く ――</div>

            <div class="title-avatar">🎰</div>

            <div class="title-quote">「退路は断った…ここから先は勝つだけだ」</div>

            <div class="title-stats">
                <div class="title-stat-row">
                    <span>手持ち</span>
                    <span class="title-stat-val">${fmt(cash)}</span>
                </div>
                <div class="title-stat-row">
                    <span>借金残高</span>
                    <span class="title-stat-val debt-val">${fmt(debt)}</span>
                </div>
                <div class="title-stat-row">
                    <span>返済累計</span>
                    <span class="title-stat-val repaid-val">${fmt(paidDebt)}</span>
                </div>
            </div>

            <button class="title-start-btn" id="titleStartBtn">ゲーム開始</button>
        </div>
    </div>
  `;

  document.getElementById("titleStartBtn").onclick = () => {
    renderUI(); // ← スロット画面へ
  };
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
      <button class="btn-small" onclick="changeBet(-100000000)">－1億</button>
      <button class="btn-small" onclick="changeBet(-10000000)">－1000万</button>
      <div class="bet-display" id="disp-bet2">${fmt(bet)}</div>
      <button class="btn-small" onclick="changeBet(10000000)">＋1000万</button>
      <button class="btn-small" onclick="changeBet(100000000)">＋1億</button>
      <button class="btn-max"   onclick="setBetMax()">MAX</button>
    </div>

    <div class="stop-row">
      <button class="btn-stop-ind" id="stop0" disabled onclick="stopReel(0)">       </button>
      <button class="btn-stop-ind" id="stop1" disabled onclick="stopReel(1)">       </button>
      <button class="btn-stop-ind" id="stop2" disabled onclick="stopReel(2)">       </button>
    </div>

    <div class="main-btn-row">
      <button class="btn-main btn-start" id="btn-start" onclick="startSpin()">START</button>
      <button class="btn-main btn-home"  onclick="goHome()">← HOME</button>
    </div>

    <div class="payout-table">
      <div class="payout-title">配当表</div>
      <div class="payout-grid">
        <div class="payout-row"><span class="payout-sym">💎💎💎 / 7️⃣7️⃣7️⃣</span><span class="payout-mult " style="color:#facc15">×4 倍（圧倒的歓喜）</span></div>
        <div class="payout-row"><span class="payout-sym">🍒 / 🔔 / 🍋 / 🍉 / 🍇 の3揃い</span><span class="payout-mult">×2 倍（通常勝利）</span></div>
        <div class="payout-row"><span class="payout-sym">上記以外</span><span class="payout-mult">0 倍</span></div>
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
  if (cash < bet) { addLog('⚠ ペリカが不足しています…！狂気の沙汰…！', 'lose'); return; }

  // 💡 ここに追記：スタート音を鳴らす
  playSound('start');
  
  cash -= bet;
  saveShared();
  updateStats();

  spinning  = true;
  stopFlags = [false, false, false];
  stopped   = 0;

  // 💡 スピン開始時のセリフ変更とざわざわ
  setKaijiLine('spin');
  triggerZawa(4);

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

const se = {
  decide: new Audio('slot/決定ボタンを押す.mp3')
};

function stopReel(idx) {
  if (!spinning || stopFlags[idx]) return;

  // ★ STOP ボタン効果音
  //playSound('decide');   // ← ここを追加（ファイル名は後で設定）
// ★ mp3 再生
  se.decide.currentTime = 0;
  se.decide.play();

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
  let resultSit = 'lose'; // セリフ連動用

  if (syms[0] === syms[1] && syms[1] === syms[2]) {
    // 💡 条件A：ダイヤモンドまたは7揃いは「×4倍」
    if (syms[0] === '💎' || syms[0] === '7️⃣') {
      winAmt = bet * 4;
      winLabel = 'HEAVEN!!'; cls = 'jackpot';
      msg = `🎉【至福…！】${syms[0]}揃いで ×4倍！ ${fmt(winAmt)} 獲得！`;
    } else {
      // 💡 条件B：それ以外の図柄揃いは「×2倍」
      winAmt = bet * 2;
      winLabel = 'WIN!'; cls = 'win';
      msg = `✨【流石…！】${syms[0]}揃いで ×2倍！ ${fmt(winAmt)} 獲得！`;
    }
  } else {
    // 💡 条件C：それ以外（はずれ）は「0倍（没収）」
    winAmt = 0;
    msg = `どん底…！ ${syms.join('')} はずれ（0倍）`;
  }
  //   const mult = PAYOUTS[syms[0]] || 1;
  //   winAmt = bet * mult;
  //   if (syms[0] === '💎') {
  //     winLabel = 'JACKPOT!!'; cls = 'jackpot';
  //     msg = `💎 JACKPOT!! → ${fmt(winAmt)} 獲得！`;
  //   } else {
  //     winLabel = 'WIN!'; cls = 'win';
  //     msg = `${syms[0]}×3 → ${fmt(winAmt)} 獲得 (×${mult})`;
  //   }
  // } else if (syms.filter(s => s === '🍒').length >= 2) {
  //   winAmt = Math.floor(bet * 1.5);
  //   cls = 'win'; winLabel = 'WIN!';
  //   msg = `🍒×2 → ${fmt(winAmt)} 獲得 (×1.5)`;
  // } else {
  //   msg = `${syms.join('')} … はずれ (−${fmt(bet)})`;
  // }

  if (winAmt > 0) {
    cash += winAmt;
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

  // index.js の resolveResult 関数内
  const sb = document.getElementById('btn-start');
  if (sb) sb.disabled = false;

// ★ 所持金が最低ベット未満なら強制帰還
if (cash < 10000000) {
    goHome();
    return;
}

}

// ─── BET 操作 ────────────────────────────────────────
function changeBet(delta) {
  // 💡 最小10万ペリカ、最大は手持ちか1000万ペリカ
  const maxLimit = Math.min(cash || INIT_CASH, 100000000);
  bet = Math.max(10000000, Math.min(maxLimit, bet + delta));
  // bet = Math.max(100, Math.min(cash || INIT_CASH, bet + delta));
  saveShared();
  updateStats();
}

function setBetMax() {
  // 💡 掛けれる額ベース最高峰：1000万ペリカ
  //bet = Math.max(100000, Math.min(cash, 10000000));
  bet = cash;   // ← 所持金そのまま
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

// ─── ゲームオーバー画面 ──────────────────────────────
function showGameOver() {

  document.getElementById('main-content').innerHTML = `
    <div class="end-screen">
      <div class="end-icon">💸</div>
      <div class="end-title lose-title">GAME OVER</div>
      <p class="end-sub">文無しになってしまった…<br>ホームに戻って状況を確認しよう。</p>
      <div class="end-stats">
        <div class="end-stat">
          <div class="end-stat-label">借金残高</div>
          <div class="end-stat-value" style="color:#ff6b6b">${fmt(debt)}</div>
        </div>
        <div class="end-stat">
          <div class="end-stat-label">返済済み</div>
          <div class="end-stat-value" style="color:#60a5fa">${fmt(paidDebt)}</div>
        </div>
      </div>
      <button class="btn-restart" onclick="initSlot()">もう一度</button>
      <button class="btn-gohome"  onclick="goHome()">← HOME</button>
    </div>`;
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
  // 💡 初期BET額を100万ペリカに設定
  bet      = parseFloat(localStorage.getItem(KEY_BET) || 10000000);
  bet      = Math.max(10000000, Math.min(cash, bet));
  // bet      = parseFloat(localStorage.getItem(KEY_BET) || 100);
  // bet      = Math.max(100, Math.min(cash, bet)); // cashを超えないよう補正

  spinning  = false;
  stopFlags = [false, false, false];
  stopped   = 0;

  renderUI();
  addLog('🎰 命を賭した勝負が今、始まる…！', 'info');
}

// ─── ローカル音源 BGM 設定（完全同期・大富豪スタイル） ───
const slotBgm = new Audio('casino.mp3');
slotBgm.loop = true;
slotBgm.volume = 0.3; // 初期音量

document.addEventListener("DOMContentLoaded", () => {
    const volSlider = document.getElementById("global-volume-slider");
    const volValText = document.getElementById("global-volume-val");

    // 【1. 数値の初期表示】スライダーの現在値(value)に合わせて表示を即座に更新する
    if (volSlider && volValText) {
        const initialVolume = parseFloat(volSlider.value);
        slotBgm.volume = initialVolume;
        volValText.innerText = Math.round(initialVolume * 100) + "%";

        // 【2. 操作時の更新】
        volSlider.oninput = (e) => {
            const volume = parseFloat(e.target.value);
            slotBgm.volume = volume;
            volValText.innerText = Math.round(volume * 100) + "%";
        };
    }

    // 【3. 自動再生の試行】ページ読み込み完了時に再生を試みる
    // ※ブラウザ設定で自動再生が許可されていれば、クリックなしで鳴ります
    slotBgm.play().then(() => {
        console.log("BGM自動再生成功");
    }).catch(() => {
        console.log("自動再生が制限されています。クリックで開始します");
        // 失敗した場合は、画面のどこかがクリックされたら鳴るようにする
        window.addEventListener('click', () => {
            slotBgm.play();
        }, { once: true });
    });
});

// ─── タイトル画面からスロットゲームへ ───
document.addEventListener("DOMContentLoaded", () => {
  initSlot();      // データ読み込み
  renderTitle();   // ← 最初はタイトル画面
});
