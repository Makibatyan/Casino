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
};

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
};

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

function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
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

  els.playerScore.textContent = `(${handValue(playerHand)})`;
  if (hideDealerHole && dealerHand.length > 0) {
    els.dealerScore.textContent = `(${cardValue(dealerHand[0])} + ?)`;
  } else {
    els.dealerScore.textContent = `(${handValue(dealerHand)})`;
  }
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
  pendingBet = amount;
  document.querySelectorAll(".chip").forEach((ch) => {
    ch.classList.toggle("selected", parseInt(ch.dataset.bet, 10) === amount);
  });
  els.customBet.value = "";
}

function placeBet() {
  const custom = parseInt(els.customBet.value, 10);
  let bet = custom > 0 ? custom : pendingBet;

  if (bet <= 0) {
    els.gameMessage.textContent = "ベット額を選んでください";
    return;
  }
  if (bet > bankroll) {
    bet = bankroll;
  }
  if (bet < 1) {
    els.gameMessage.textContent = "ベットできません";
    return;
  }

  currentBet = bet;
  bankroll -= bet;
  els.currentBet.textContent = formatCoins(currentBet);
  updateHUD();
  setKaijiLine("bet");
  startRound();
}

// --- ラウンド開始 ---
function startRound() {
  phase = "playing";
  doubled = false;
  playerHand = [];
  dealerHand = [];
  deck = deck.length ? deck : createDeck();

  playerHand.push(drawCard(), drawCard());
  dealerHand.push(drawCard(), drawCard());

  showBetPanel(false);
  els.gameMessage.textContent = "";
  renderHands(true);
  setKaijiLine("deal");

  // 即時ブラックジャック判定
  const playerBJ = isBlackjack(playerHand);
  const dealerBJ = isBlackjack(dealerHand);

  if (playerBJ || dealerBJ) {
    revealAndSettle(playerBJ, dealerBJ);
    return;
  }

  setControls({
    hit: true,
    stand: true,
    double: bankroll >= currentBet && playerHand.length === 2,
    newRound: false,
  });
}

function hit() {
  if (phase !== "playing") return;
  setKaijiLine("hit");
  playerHand.push(drawCard());
  renderHands(true);

  const val = handValue(playerHand);
  if (val > 21) {
    endRound("bust", 0);
  } else if (val === 21) {
    stand();
  } else {
    setControls({
      hit: true,
      stand: true,
      double: false,
      newRound: false,
    });
  }
}

function doubleDown() {
  if (phase !== "playing" || playerHand.length !== 2) return;
  if (bankroll < currentBet) return;

  bankroll -= currentBet;
  currentBet *= 2;
  doubled = true;
  els.currentBet.textContent = formatCoins(currentBet);
  updateHUD();
  setKaijiLine("hit");

  playerHand.push(drawCard());
  renderHands(true);

  const val = handValue(playerHand);
  if (val > 21) {
    endRound("bust", 0);
  } else {
    dealerTurn();
  }
}

function stand() {
  if (phase !== "playing") return;
  setKaijiLine("stand");
  dealerTurn();
}

async function dealerTurn() {
  phase = "dealer";
  setControls({ hit: false, stand: false, double: false, newRound: false });

  renderHands(false);

  while (handValue(dealerHand) < 17) {
    await delay(600);
    dealerHand.push(drawCard());
    renderHands(false);
  }

  await delay(400);
  settleRound();
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function revealAndSettle(playerBJ, dealerBJ) {
  renderHands(false);
  phase = "ended";

  if (playerBJ && dealerBJ) {
    endRound("push", currentBet);
  } else if (playerBJ) {
    const payout = Math.floor(currentBet * 2.5);
    endRound("blackjack", payout);
  } else if (dealerBJ) {
    endRound("lose", 0);
  }
}

function settleRound() {
  const pVal = handValue(playerHand);
  const dVal = handValue(dealerHand);

  if (dVal > 21) {
    endRound("dealerBust", currentBet * 2);
  } else if (pVal > dVal) {
    endRound("win", currentBet * 2);
  } else if (pVal < dVal) {
    endRound("lose", 0);
  } else {
    endRound("push", currentBet);
  }
}

function endRound(result, payout) {
  phase = "ended";
  renderHands(false);
  setControls({ hit: false, stand: false, double: false, newRound: true });

  let net = payout - (result === "push" ? 0 : 0);
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
      message = `勝利！ +${formatCoins(net)} コイン`;
      kaijiCategory = "win";
      showCoinPopup(net, true);
      if (net >= 5000) setKaijiLine("bigWin");
      break;
    case "dealerBust":
      bankroll += payout;
      net = currentBet;
      sessionCoins += net;
      winStreak++;
      message = `ディーラーバースト！ +${formatCoins(net)} コイン`;
      kaijiCategory = "dealerBust";
      showCoinPopup(net, true);
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
      message = `敗北… -${formatCoins(currentBet)} コイン`;
      kaijiCategory = "lose";
      winStreak = 0;
      showCoinPopup(currentBet, false);
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
  currentBet = 0;
  pendingBet = 0;
  els.currentBet.textContent = "0";
  els.gameMessage.textContent = "";
  els.customBet.value = "";
  document.querySelectorAll(".chip").forEach((ch) => ch.classList.remove("selected"));

  playerHand = [];
  dealerHand = [];
  els.playerCards.innerHTML = "";
  els.dealerCards.innerHTML = "";
  els.playerScore.textContent = "";
  els.dealerScore.textContent = "";

  showBetPanel(true);
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
els.btnStart.addEventListener("click", startGame);
els.btnRestart.addEventListener("click", restartGame);
els.btnPlaceBet.addEventListener("click", placeBet);
els.btnHit.addEventListener("click", hit);
els.btnStand.addEventListener("click", stand);
els.btnDouble.addEventListener("click", doubleDown);
els.btnNewRound.addEventListener("click", newRound);

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    selectChip(parseInt(chip.dataset.bet, 10));
  });
});

// スタート画面のセリフローテーション
els.startQuote.textContent = pickRandom(START_QUOTES);
setInterval(() => {
  if (screens.start.classList.contains("active")) {
    els.startQuote.textContent = pickRandom(START_QUOTES);
  }
}, 4000);
