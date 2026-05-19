/**
 * カイジのブラックジャック
 * 1人 vs ディーラー / コイン・ベット制
 */

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RED_SUITS = new Set(["♥", "♦"]);

// カイジのセリフ（状況別）
const KAIJI_LINES = {
  start: [
    "「俺は負けたままじゃ終われない…」",
    "「退路は断った。ここから先は勝つだけだ」",
    "「運命は自分の手で切り開く——」",
  ],
  bet: [
    "「全てを賭ける覚悟ができているか…？」",
    "「この一手で人生が変わる。怖くないか？」",
    "「さあ、賭けの時間だ…」",
    "「コイン一枚一枚が、俺の命綱だ」",
  ],
  deal: [
    "「カードは神の領域…だが、読める」",
    "「運は味方するか、裏切るか」",
    "「深呼吸だ…冷静にいけ」",
  ],
  hit: [
    "「もう一枚…運を試す」",
    "「欲張りは禁物だが——今は引く」",
  ],
  stand: [
    "「ここで勝負を決める」",
    "「見せてやる、俺の覚悟を」",
  ],
  win: [
    "「勝った…！この調子だ！」",
    "「神は俺に味方した！」",
    "「借金返済への一歩だ…！」",
    "「ふっ…まだまだいける」",
  ],
  lose: [
    "「くそっ…まだ終わりじゃない」",
    "「負けた…だが、ここで止まるわけにはいかない」",
    "「次こそ…必ず取り返す」",
  ],
  bust: [
    "「バーストか…早期リタイアだ」",
    "「欲張ったか…自分の負けだ」",
  ],
  blackjack: [
    "「ブラックジャック！…これが俺の切り札だ！」",
    "「21点…運命は今、俺の側にある」",
  ],
  dealerBust: [
    "「相手のミスを突け！…勝利だ！」",
    "「ディーラーがバースト…天は俺を見ている」",
  ],
  push: [
    "「引き分けか…次こそ決着を」",
    "「同点…まだ勝負は続く」",
  ],
  lowMoney: [
    "「コインが残りわずか…背水の陣だ」",
    "「これ以上負けたら終わりだ…慎重に」",
  ],
  bankrupt: [
    "「まだ…終わってない…」",
    "「一度は倒れても、また立ち上がる…」",
    "「負け犬のままじゃ終われない…！」",
  ],
  bigWin: [
    "「大勝だ…！この興奮を忘れるな」",
    "「一気に形勢を逆転させた…！」",
  ],
  streak: [
    "「連勝…手が震える。これが勝者の感覚か」",
    "「調子がいい…だが油断は禁物だ」",
  ],
  tension: [
    "「空気が…ざわついてる…」",
    "「この静けさが、嵐の前だ…」",
    "「鼓動がうるさい…落ち着け、俺」",
    "「一瞬の判断が、全てを決める——」",
  ],
};

const DEALER_HIT_DELAY = 650;
const TENSION_HIT_DELAY = 1550;
const ZAWAZAWA_CHANCE = 0.18;

const START_QUOTES = KAIJI_LINES.start;

// --- ゲーム状態 ---
let deck = [];
let playerHand = [];
let dealerHand = [];
let bankroll = 10000;
let initialBankroll = 10000;
let sessionCoins = 0;
let currentBet = 0;
let pendingBet = 0;
let winStreak = 0;
let phase = "betting"; // betting | playing | dealer | ended
let doubled = false;
let fxFlags = { player21: false, dealer21: false };
let lastBetTier = "mid";
let actionLock = false;

// --- DOM ---
const screens = {
  start: document.getElementById("start-screen"),
  game: document.getElementById("game-screen"),
  gameover: document.getElementById("gameover-screen"),
};

const els = {
  bankroll: document.getElementById("bankroll"),
  sessionCoins: document.getElementById("session-coins"),
  winStreak: document.getElementById("win-streak"),
  kaijiDialogue: document.getElementById("kaiji-dialogue"),
  dealerCards: document.getElementById("dealer-cards"),
  playerCards: document.getElementById("player-cards"),
  dealerScore: document.getElementById("dealer-score"),
  playerScore: document.getElementById("player-score"),
  gameMessage: document.getElementById("game-message"),
  betPanel: document.getElementById("bet-panel"),
  currentBet: document.getElementById("current-bet"),
  customBet: document.getElementById("custom-bet"),
  btnHit: document.getElementById("btn-hit"),
  btnStand: document.getElementById("btn-stand"),
  btnDouble: document.getElementById("btn-double"),
  btnNewRound: document.getElementById("btn-new-round"),
  btnPlaceBet: document.getElementById("btn-place-bet"),
  btnStart: document.getElementById("btn-start"),
  btnRestart: document.getElementById("btn-restart"),
  initialBankroll: document.getElementById("initial-bankroll"),
  startQuote: document.getElementById("start-quote"),
  finalBankroll: document.getElementById("final-bankroll"),
  finalSession: document.getElementById("final-session"),
  gameoverQuote: document.getElementById("gameover-quote"),
  maxBet: document.getElementById("max-bet"),
  betError: document.getElementById("bet-error"),
  fxOverlay: document.getElementById("fx-overlay"),
  gameScreen: document.getElementById("game-screen"),
  playerArea: document.getElementById("player-area"),
  dealerArea: document.getElementById("dealer-area"),
  btnSound: document.getElementById("btn-sound"),
  btnPresetA: document.getElementById("btn-preset-a"),
  btnPresetE: document.getElementById("btn-preset-e"),
  gameTable: document.getElementById("game-table"),
};

// 効果音は sounds.js（リアル合成音）

function getBetTier(bet, availableCoins) {
  if (bet >= availableCoins && availableCoins > 0) return "allin";
  if (bet < 300) return "low";
  if (bet < 1500) return "mid";
  if (bet < 5000) return "high";
  return "ultra";
}

// --- ユーティリティ ---
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatCoins(n) {
  return n.toLocaleString("ja-JP");
}

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

function setKaijiLine(category, forceLine) {
  const line = forceLine || pickRandom(KAIJI_LINES[category] || KAIJI_LINES.bet);
  els.kaijiDialogue.textContent = line;
  els.kaijiDialogue.style.animation = "none";
  void els.kaijiDialogue.offsetWidth;
  els.kaijiDialogue.style.animation = "";
}

function showCoinPopup(amount, isWin) {
  const pop = document.createElement("div");
  pop.className = `coin-popup ${isWin ? "" : "lose"}`;
  pop.textContent = isWin ? `+${formatCoins(amount)}` : `-${formatCoins(Math.abs(amount))}`;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 1200);
}

function setBetError(msg) {
  els.betError.textContent = msg || "";
}

function updateBetUI() {
  const max = bankroll;
  els.maxBet.textContent = formatCoins(max);
  els.customBet.max = max;
  els.customBet.min = max > 0 ? 1 : 0;

  document.querySelectorAll(".chip").forEach((chip) => {
    const isAllIn = chip.dataset.bet === "allin";
    const amount = isAllIn ? max : parseInt(chip.dataset.bet, 10);
    const overLimit = !isAllIn && amount > max;
    chip.disabled = (overLimit || max <= 0) && !isAllIn;
    if (isAllIn) chip.disabled = max <= 0;
    if (overLimit) chip.classList.remove("selected");
  });

  if (pendingBet > max) {
    pendingBet = max > 0 ? max : 0;
    document.querySelectorAll(".chip").forEach((ch) => {
      ch.classList.toggle("selected", parseInt(ch.dataset.bet, 10) === pendingBet);
    });
  }

  const customVal = parseInt(els.customBet.value, 10);
  if (!Number.isNaN(customVal) && customVal > max) {
    els.customBet.classList.add("input-error");
  } else {
    els.customBet.classList.remove("input-error");
  }

  els.btnPlaceBet.disabled = max <= 0;
}

function createParticles(type, count = 24) {
  const container = document.createElement("div");
  container.className = "fx-particles";
  const cls = type === "blackjack" ? "gold" : "red";
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = `fx-particle ${cls}`;
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 80 + Math.random() * 160;
    p.style.left = "50%";
    p.style.top = "50%";
    p.style.setProperty("--tx", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--ty", `${Math.sin(angle) * dist}px`);
    p.style.animationDelay = `${Math.random() * 0.2}s`;
    container.appendChild(p);
  }
  return container;
}

const FX_COPY = {
  player: {
    bust: { banner: "BUST!", sub: "21超過 — 敗北" },
    blackjack: { banner: "BLACKJACK!", sub: "21 — 運命の一手", naturalSub: "21 — 運命の一手" },
  },
  dealer: {
    bust: { banner: "DEALER BUST!", sub: "ディーラー敗北" },
    blackjack: { banner: "DEALER 21!", sub: "ディーラーが21に到達", naturalSub: "ディーラーのブラックジャック" },
  },
};

function playSpecialEffect(type, target = "player") {
  return new Promise((resolve) => {
    const overlay = els.fxOverlay;
    const isDealer = target === "dealer";
    const area = isDealer ? els.dealerArea : els.playerArea;
    const hand = isDealer ? dealerHand : playerHand;
    const copy = FX_COPY[isDealer ? "dealer" : "player"][type];
    const natural = type === "blackjack" && isNaturalBlackjack(hand);

    overlay.innerHTML = "";
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");

    const flash = document.createElement("div");
    flash.className = `fx-flash ${type === "blackjack" ? "bj-flash" : "bust-flash"}`;
    overlay.appendChild(flash);
    overlay.appendChild(createParticles(type));

    const banner = document.createElement("div");
    const bannerExtra = isDealer
      ? type === "blackjack"
        ? "dealer-bj-banner"
        : "dealer-bust-banner"
      : "";
    banner.className = `fx-banner ${type === "blackjack" ? "bj-banner" : "bust-banner"} ${bannerExtra}`.trim();
    banner.textContent = copy.banner;
    overlay.appendChild(banner);

    const sub = document.createElement("div");
    sub.className = `fx-sub ${type === "blackjack" ? "bj-sub" : "bust-sub"}`;
    sub.textContent = natural && copy.naturalSub ? copy.naturalSub : copy.sub;
    overlay.appendChild(sub);

    if (type === "bust") {
      if (isDealer) {
        els.dealerArea.classList.add("fx-shake-bust", "fx-cards-bust");
        fxFlags.dealer21 = false;
      } else {
        els.gameScreen.classList.add("fx-shake-bust");
        els.playerArea.classList.add("fx-cards-bust");
        fxFlags.player21 = false;
      }
      Sound.play("bust");
    } else {
      area.classList.add("fx-cards-bj");
      if (isDealer) fxFlags.dealer21 = true;
      else fxFlags.player21 = true;
      Sound.play("blackjack");
    }

    const duration = type === "blackjack" ? 1500 : 1200;
    setTimeout(() => {
      overlay.classList.remove("active");
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML = "";
      els.gameScreen.classList.remove("fx-shake-bust");
      els.playerArea.classList.remove("fx-cards-bust", "fx-cards-bj");
      els.dealerArea.classList.remove("fx-shake-bust", "fx-cards-bust", "fx-cards-bj");
      resolve();
    }, duration);
  });
}

function isTwentyOne(hand) {
  return hand.length > 0 && handValue(hand) === 21;
}

function isNaturalBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}

async function playPlayer21Effect() {
  if (fxFlags.player21) return;
  await playSpecialEffect("blackjack", "player");
}

async function playDealer21Effect() {
  if (fxFlags.dealer21) return;
  await playSpecialEffect("blackjack", "dealer");
}

async function playEffectsForResult(result) {
  const player21 = isTwentyOne(playerHand);
  const dealer21 = isTwentyOne(dealerHand);
  const dealerBusted = result === "dealerBust" || handValue(dealerHand) > 21;

  if (result === "bust") {
    await playSpecialEffect("bust", "player");
    return;
  }

  // ディーラーバースト + プレイヤー21 → プレイヤー演出を最優先
  if (dealerBusted && player21) {
    await playPlayer21Effect();
    return;
  }

  if (result === "blackjack" || ((result === "win" || result === "dealerBust") && player21)) {
    await playPlayer21Effect();
    return;
  }

  if (result === "dealerBust") {
    await playSpecialEffect("bust", "dealer");
    return;
  }

  if (result === "lose" && dealer21) {
    await playDealer21Effect();
    return;
  }

  if (result === "push" && player21 && !dealer21) {
    await playPlayer21Effect();
  } else if (result === "push" && dealer21 && !player21) {
    await playDealer21Effect();
  }
}

function dealerShouldHit() {
  const dVal = handValue(dealerHand);
  const pVal = handValue(playerHand);

  if (dVal > 21) return false;
  if (isTwentyOne(dealerHand)) return false;
  if (dVal < 17) return true;
  return dVal < pVal;
}

function updateHUD() {
  els.bankroll.textContent = formatCoins(bankroll);
  els.sessionCoins.textContent = (sessionCoins >= 0 ? "+" : "") + formatCoins(sessionCoins);
  els.sessionCoins.classList.toggle("negative", sessionCoins < 0);
  els.winStreak.textContent = String(winStreak);

  if (bankroll > 0 && bankroll <= initialBankroll * 0.2) {
    setKaijiLine("lowMoney");
  }
}

// --- デッキ ---
function createDeck() {
  const cards = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ suit, rank });
    }
  }
  return shuffle(cards);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function drawCard() {
  if (deck.length < 15) {
    deck = createDeck();
  }
  return deck.pop();
}

// --- スコア ---
function cardValue(card) {
  if (card.rank === "A") return 11;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return parseInt(card.rank, 10);
}

function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    total += cardValue(c);
    if (c.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

/** 配札時のナチュラルBJ判定（配当用） */
function isBlackjack(hand) {
  return isNaturalBlackjack(hand);
}

// --- 描画 ---
function renderCard(card, hidden = false) {
  const el = document.createElement("div");
  el.className = "card" + (hidden ? " hidden" : "");
  if (!hidden) {
    const isRed = RED_SUITS.has(card.suit);
    el.classList.add(isRed ? "red" : "black");
    el.innerHTML = `<span class="rank">${card.rank}</span><span class="suit">${card.suit}</span>`;
  }
  return el;
}

function renderHands(hideDealerHole = true) {
  els.playerCards.innerHTML = "";
  els.dealerCards.innerHTML = "";

  playerHand.forEach((c) => els.playerCards.appendChild(renderCard(c)));
  dealerHand.forEach((c, i) => {
    const hide = hideDealerHole && i === 1;
    els.dealerCards.appendChild(renderCard(c, hide));
  });

  updateScores(hideDealerHole);
}

function updateScores(hideDealerHole = true) {
  els.playerScore.textContent = `(${handValue(playerHand)})`;
  if (hideDealerHole && dealerHand.length > 0) {
    els.dealerScore.textContent = `(${cardValue(dealerHand[0])} + ?)`;
  } else {
    els.dealerScore.textContent = `(${handValue(dealerHand)})`;
  }
}

/** プレイヤーにカードを1枚だけ追加表示（ダブル・ヒット用） */
function appendPlayerCard(card) {
  els.playerCards.appendChild(renderCard(card));
  els.playerScore.textContent = `(${handValue(playerHand)})`;
}

// --- フェーズ制御 ---
function setControls({ hit, stand, double, newRound }) {
  els.btnHit.disabled = !hit;
  els.btnStand.disabled = !stand;
  els.btnDouble.disabled = !double;
  els.btnNewRound.disabled = !newRound;
}

function showBetPanel(show) {
  els.betPanel.classList.toggle("hidden", !show);
}

// --- ベット ---
function selectChip(amount) {
  setBetError("");
  if (amount > bankroll) {
    setBetError(`所持コイン（${formatCoins(bankroll)}）を超えるベットはできません`);
    return;
  }
  pendingBet = amount;
  document.querySelectorAll(".chip").forEach((ch) => {
    const chipAmt = ch.dataset.bet === "allin" ? bankroll : parseInt(ch.dataset.bet, 10);
    ch.classList.toggle("selected", chipAmt === amount);
  });
  els.customBet.value = "";
  els.customBet.classList.remove("input-error");
}

function selectAllIn() {
  setBetError("");
  if (bankroll < 1) {
    setBetError("ベットできるコインがありません");
    return;
  }
  pendingBet = bankroll;
  document.querySelectorAll(".chip").forEach((ch) => {
    ch.classList.toggle("selected", ch.dataset.bet === "allin");
  });
  els.customBet.value = "";
  els.customBet.classList.remove("input-error");
}

function placeBet() {
  setBetError("");
  const custom = parseInt(els.customBet.value, 10);
  let bet = !Number.isNaN(custom) && custom > 0 ? custom : pendingBet;

  if (bet <= 0) {
    setBetError("ベット額を選んでください");
    return;
  }
  if (bet > bankroll) {
    setBetError(`所持コイン（${formatCoins(bankroll)}）を超えるベットはできません`);
    els.customBet.classList.add("input-error");
    return;
  }
  if (bankroll < 1) {
    setBetError("ベットできるコインがありません");
    return;
  }

  lastBetTier = getBetTier(bet, bankroll);
  currentBet = bet;
  bankroll -= bet;
  els.currentBet.textContent = formatCoins(currentBet);
  updateHUD();
  setKaijiLine("bet");
  Sound.init();
  Sound.play("bet", { tier: lastBetTier });
  startRound();
}

// --- ラウンド開始 ---
function startRound() {
  phase = "playing";
  doubled = false;
  actionLock = false;
  fxFlags = { player21: false, dealer21: false };
  playerHand = [];
  dealerHand = [];
  deck = deck.length ? deck : createDeck();

  playerHand.push(drawCard(), drawCard());
  dealerHand.push(drawCard(), drawCard());
  Sound.play("deal");
  Sound.play("deal", { when: 0.1 });

  showBetPanel(false);
  els.gameMessage.textContent = "";
  renderHands(true);
  setKaijiLine("deal");

  // 即時ブラックジャック判定
  const playerBJ = isBlackjack(playerHand);
  const dealerBJ = isBlackjack(dealerHand);

  if (playerBJ || dealerBJ) {
    void revealAndSettle(playerBJ, dealerBJ);
    return;
  }

  setControls({
    hit: true,
    stand: true,
    double: bankroll >= currentBet && playerHand.length === 2,
    newRound: false,
  });
}

async function hit() {
  if (phase !== "playing" || actionLock || doubled) return;
  actionLock = true;
  setControls({ hit: false, stand: false, double: false, newRound: false });

  setKaijiLine("hit");
  Sound.play("hit");
  const card = drawCard();
  playerHand.push(card);
  appendPlayerCard(card);

  const val = handValue(playerHand);
  actionLock = false;
  if (val > 21) {
    void endRound("bust", 0);
  } else if (val === 21) {
    await playPlayer21Effect();
    await stand();
  } else {
    setControls({
      hit: true,
      stand: true,
      double: false,
      newRound: false,
    });
  }
}

async function doubleDown() {
  if (phase !== "playing" || playerHand.length !== 2 || actionLock || doubled) return;
  if (bankroll < currentBet) {
    els.gameMessage.textContent = "ダブルに必要なコインが足りません";
    return;
  }

  actionLock = true;
  doubled = true;
  setControls({ hit: false, stand: false, double: false, newRound: false });

  bankroll -= currentBet;
  currentBet *= 2;
  lastBetTier = getBetTier(currentBet, bankroll + currentBet);
  els.currentBet.textContent = formatCoins(currentBet);
  updateHUD();
  setKaijiLine("hit");

  await delay(200);
  Sound.play("double");
  const card = drawCard();
  playerHand.push(card);
  appendPlayerCard(card);

  await delay(400);

  const val = handValue(playerHand);
  actionLock = false;

  if (val > 21) {
    void endRound("bust", 0);
  } else if (val === 21) {
    await playPlayer21Effect();
    await dealerTurn();
  } else {
    await dealerTurn();
  }
}

async function stand() {
  if (phase !== "playing") return;
  setKaijiLine("stand");
  Sound.play("stand");
  await dealerTurn();
}

async function dealerTurn() {
  phase = "dealer";
  setControls({ hit: false, stand: false, double: false, newRound: false });

  renderHands(false);

  try {
    while (dealerShouldHit()) {
      await waitDealerHitPause();
      const chasing = handValue(dealerHand) >= 17;
      if (chasing && !els.gameMessage.textContent.includes("ざわ")) {
        els.gameMessage.textContent = "ディーラーが勝つためヒット…";
      }
      Sound.play("dealerHit");
      dealerHand.push(drawCard());
      renderHands(false);

      if (handValue(dealerHand) > 21) {
        setTensionMode(false);
        await delay(300);
        await settleRound();
        return;
      }
      if (handValue(dealerHand) === 21) {
        await playDealer21Effect();
      }
    }
  } finally {
    setTensionMode(false);
  }

  els.gameMessage.textContent = "";
  await delay(400);
  await settleRound();
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isDealerTensionMoment() {
  const d = handValue(dealerHand);
  const p = handValue(playerHand);
  return dealerShouldHit() && d < p && d <= 21;
}

function setTensionMode(on) {
  els.gameScreen.classList.toggle("tension-mode", on);
}

async function playZawazawa() {
  const overlay = document.createElement("div");
  overlay.className = "zawazawa-overlay";
  overlay.innerHTML =
    '<span class="zaw-text">ざわ…</span><span class="zaw-text zaw-delay">ざわざわ……</span>';
  els.gameTable.appendChild(overlay);
  setKaijiLine("tension");
  Sound.play("zawazawa");
  await delay(1600);
  overlay.remove();
}

async function waitDealerHitPause() {
  const tension = isDealerTensionMoment();
  if (!tension) {
    await delay(DEALER_HIT_DELAY);
    return;
  }
  setTensionMode(true);
  els.gameMessage.textContent = `ディーラー ${handValue(dealerHand)} → あなた ${handValue(playerHand)}…勝負のカード`;
  if (Math.random() < ZAWAZAWA_CHANCE) {
    await playZawazawa();
  } else {
    await delay(TENSION_HIT_DELAY);
  }
}

async function revealAndSettle(playerBJ, dealerBJ) {
  renderHands(false);
  phase = "ended";

  if (playerBJ && dealerBJ) {
    await endRound("push", currentBet);
  } else if (playerBJ) {
    const payout = Math.floor(currentBet * 2.5);
    await endRound("blackjack", payout);
  } else if (dealerBJ) {
    await endRound("lose", 0);
  }
}

async function settleRound() {
  const pVal = handValue(playerHand);
  const dVal = handValue(dealerHand);

  if (dVal > 21) {
    await endRound("dealerBust", currentBet * 2);
  } else if (pVal > dVal) {
    await endRound("win", currentBet * 2);
  } else if (pVal < dVal) {
    await endRound("lose", 0);
  } else {
    await endRound("push", currentBet);
  }
}

async function endRound(result, payout) {
  phase = "ended";
  renderHands(false);
  setControls({ hit: false, stand: false, double: false, newRound: false });

  await playEffectsForResult(result);

  setControls({ hit: false, stand: false, double: false, newRound: true });

  let net = 0;
  let message = "";
  let kaijiCategory = "lose";

  switch (result) {
    case "blackjack":
      bankroll += payout;
      net = payout - currentBet;
      sessionCoins += net;
      winStreak++;
      message = `ブラックジャック！ +${formatCoins(net)} コイン`;
      kaijiCategory = "blackjack";
      showCoinPopup(net, true);
      if (net >= currentBet * 1.5) setKaijiLine("bigWin");
      break;
    case "win":
      bankroll += payout;
      net = currentBet;
      sessionCoins += net;
      winStreak++;
      message = isTwentyOne(playerHand)
        ? `21点達成！ +${formatCoins(net)} コイン`
        : `勝利！ +${formatCoins(net)} コイン`;
      kaijiCategory = isTwentyOne(playerHand) ? "blackjack" : "win";
      showCoinPopup(net, true);
      if (!fxFlags.player21) Sound.play("win", { tier: lastBetTier });
      if (net >= 5000) setKaijiLine("bigWin");
      break;
    case "dealerBust":
      bankroll += payout;
      net = currentBet;
      sessionCoins += net;
      winStreak++;
      message = isTwentyOne(playerHand)
        ? `21点 & ディーラーバースト！ +${formatCoins(net)} コイン`
        : `ディーラーバースト！ +${formatCoins(net)} コイン`;
      kaijiCategory = isTwentyOne(playerHand) ? "blackjack" : "dealerBust";
      showCoinPopup(net, true);
      if (!fxFlags.player21) Sound.play("win", { tier: lastBetTier });
      break;
    case "push":
      bankroll += payout;
      net = 0;
      message = `引き分け — ベット ${formatCoins(currentBet)} を返還`;
      kaijiCategory = "push";
      winStreak = 0;
      break;
    case "bust":
      net = -currentBet;
      sessionCoins += net;
      message = `バースト… -${formatCoins(currentBet)} コイン`;
      kaijiCategory = "bust";
      winStreak = 0;
      showCoinPopup(currentBet, false);
      break;
    case "lose":
    default:
      net = -currentBet;
      sessionCoins += net;
      message = isTwentyOne(dealerHand)
        ? `ディーラー21点… -${formatCoins(currentBet)} コイン`
        : `敗北… -${formatCoins(currentBet)} コイン`;
      kaijiCategory = "lose";
      winStreak = 0;
      showCoinPopup(currentBet, false);
      Sound.play("lose");
      break;
  }

  els.gameMessage.textContent = message;
  setKaijiLine(kaijiCategory);

  if (winStreak >= 3) {
    setTimeout(() => setKaijiLine("streak"), 1500);
  }

  updateHUD();
  checkBankrupt();
}

function checkBankrupt() {
  if (bankroll <= 0) {
    setTimeout(() => {
      els.finalBankroll.textContent = formatCoins(bankroll);
      els.finalSession.textContent = (sessionCoins >= 0 ? "+" : "") + formatCoins(sessionCoins);
      els.gameoverQuote.textContent = pickRandom(KAIJI_LINES.bankrupt);
      showScreen("gameover");
    }, 2000);
  }
}

function newRound() {
  if (bankroll <= 0) {
    checkBankrupt();
    return;
  }

  phase = "betting";
  actionLock = false;
  doubled = false;
  fxFlags = { player21: false, dealer21: false };
  currentBet = 0;
  pendingBet = 0;
  els.currentBet.textContent = "0";
  els.gameMessage.textContent = "";
  els.customBet.value = "";
  els.customBet.classList.remove("input-error");
  setBetError("");
  document.querySelectorAll(".chip").forEach((ch) => ch.classList.remove("selected"));

  playerHand = [];
  dealerHand = [];
  els.playerCards.innerHTML = "";
  els.dealerCards.innerHTML = "";
  els.playerScore.textContent = "";
  els.dealerScore.textContent = "";

  showBetPanel(true);
  updateBetUI();
  setControls({ hit: false, stand: false, double: false, newRound: false });
  setKaijiLine("bet");
}

function startGame() {
  const startAmount = parseInt(els.initialBankroll.value, 10) || 10000;
  initialBankroll = Math.max(100, Math.min(999999, startAmount));
  bankroll = initialBankroll;
  sessionCoins = 0;
  winStreak = 0;
  currentBet = 0;
  pendingBet = 0;
  deck = createDeck();

  updateHUD();
  showScreen("game");
  newRound();
}

function restartGame() {
  showScreen("start");
  els.startQuote.textContent = pickRandom(START_QUOTES);
}

// --- イベント ---
if (els.btnSound) {
  els.btnSound.addEventListener("click", () => {
    Sound.init();
    Sound.toggle();
  });
}

els.btnStart.addEventListener("click", () => {
  Sound.init();
  startGame();
});
els.btnRestart.addEventListener("click", restartGame);
els.btnPlaceBet.addEventListener("click", placeBet);
els.btnHit.addEventListener("click", hit);
els.btnStand.addEventListener("click", stand);
els.btnDouble.addEventListener("click", () => {
  void doubleDown();
});
els.btnNewRound.addEventListener("click", newRound);

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chip.disabled) return;
    if (chip.dataset.bet === "allin") {
      selectAllIn();
    } else {
      selectChip(parseInt(chip.dataset.bet, 10));
    }
  });
});

if (els.btnPresetA) {
  els.btnPresetA.addEventListener("click", () => {
    Sound.init();
    Sound.setPreset("A");
  });
}
if (els.btnPresetE) {
  els.btnPresetE.addEventListener("click", () => {
    Sound.init();
    Sound.setPreset("E");
  });
}
Sound.setPreset("E");

els.customBet.addEventListener("input", () => {
  setBetError("");
  const val = parseInt(els.customBet.value, 10);
  if (!Number.isNaN(val) && val > bankroll) {
    els.customBet.classList.add("input-error");
    setBetError(`最大 ${formatCoins(bankroll)} コインまで`);
  } else {
    els.customBet.classList.remove("input-error");
    pendingBet = 0;
    document.querySelectorAll(".chip").forEach((ch) => ch.classList.remove("selected"));
  }
});

// スタート画面のセリフローテーション
els.startQuote.textContent = pickRandom(START_QUOTES);
setInterval(() => {
  if (screens.start.classList.contains("active")) {
    els.startQuote.textContent = pickRandom(START_QUOTES);
  }
}, 4000);
