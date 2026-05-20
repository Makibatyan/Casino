/**
 * UI演出・カードアニメ・コイン飛翔・パチンコ風「台熱」心理演出
 * ※カードの出目は改ざんせず、演出とボーナスコインのみ
 */
const FX = {
  layer: null,
  heatFill: null,
  heatLabel: null,
  vignette: null,
  transition: null,
  heat: 20,
  lossStreak: 0,
  roundsPlayed: 0,
  rushActive: false,

  init() {
    this.layer = document.getElementById("fx-layer");
    this.heatFill = document.getElementById("heat-fill");
    this.heatLabel = document.getElementById("heat-label");
    this.vignette = document.getElementById("vignette-tension");
    this.transition = document.getElementById("screen-transition");
    this.updateHeatUI();
  },

  delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  },

  /* ---------- 画面遷移 (#7) ---------- */
  async screenTransition(switchFn) {
    if (!this.transition) {
      switchFn();
      return;
    }
    this.transition.classList.add("active");
    await this.delay(280);
    switchFn();
    await this.delay(80);
    this.transition.classList.remove("active");
    await this.delay(280);
  },

  /* ---------- 台の熱・パチンコ風心理 ---------- */
  updateHeatUI() {
    const h = this.heat;
    if (this.heatFill) this.heatFill.style.width = `${h}%`;
    if (this.heatLabel) {
      if (h >= 85) this.heatLabel.textContent = "RUSH";
      else if (h >= 60) this.heatLabel.textContent = "熱め";
      else if (h >= 35) this.heatLabel.textContent = "普通";
      else this.heatLabel.textContent = "冷たい";
    }
    if (els?.gameTable) {
      els.gameTable.classList.toggle("table-rush", this.rushActive);
    }
  },

  enterRush() {
    if (this.rushActive) return;
    this.rushActive = true;
    els?.gameScreen?.classList.add("rush-mode");
    this.updateHeatUI();
    if (els?.gameMessage) {
      els.gameMessage.textContent = "🔥 台が熱い…大当たりの予感";
    }
    setKaijiLine("rush");
  },

  exitRush() {
    if (!this.rushActive) return;
    this.rushActive = false;
    els?.gameScreen?.classList.remove("rush-mode");
    this.updateHeatUI();
  },

  /** ラウンド終了時：熱量・ボーナス・ニアミス */
  onRoundEnd(result, net, ctx) {
    this.roundsPlayed++;
    const { pVal, dVal, currentBet } = ctx;

    if (net > 0) {
      this.lossStreak = 0;
    } else if (result !== "push") {
      this.lossStreak++;
    }

    const betFactor = Math.min(4, currentBet / 800);
    if (net > 0) {
      this.heat = Math.min(100, this.heat + 6 + betFactor * 2);
    } else if (result !== "push") {
      this.heat = Math.max(5, this.heat - 4);
    } else {
      this.heat = Math.min(100, this.heat + 2);
    }

    // 連敗後の「甘い気配」（パチンコの回収タイミング風）
    if (this.lossStreak >= 3) {
      this.heat = Math.min(100, this.heat + 10 + this.lossStreak * 2);
      if (this.lossStreak === 3) {
        setKaijiLine("recovery");
        this.showFloatText("復活の兆し…？", "recovery-text");
      }
    }

    // 変動比率：低確率で熱が跳ねる
    if (Math.random() < 0.1) {
      this.heat = Math.min(100, this.heat + 15 + Math.random() * 10);
      this.showFloatText("熱が上がった…！", "heat-spike");
    }

    if (this.heat >= 85) this.enterRush();
    else if (this.heat < 70) this.exitRush();

    this.updateHeatUI();

    // ニアミス（負けたが僅差）
    if (result === "lose" && pVal >= 17 && dVal > pVal && dVal - pVal <= 2) {
      this.nearMiss(pVal, dVal);
    }

    // 熱い台ボーナス（出目改ざんなし）
    return this.rollHeatBonus(net);
  },

  rollHeatBonus(net) {
    if (net <= 0) return 0;
    const chance = this.heat >= 85 ? 0.5 : this.heat >= 60 ? 0.25 : 0.08;
    if (Math.random() < chance) {
      const bonus = Math.floor(net * (0.08 + Math.random() * 0.17));
      if (bonus > 0) {
        this.showFloatText(`熱ボーナス +${formatCoins(bonus)}`, "bonus-text");
        setKaijiLine("bonus");
      }
      return bonus;
    }
    return 0;
  },

  nearMiss(pVal, dVal) {
    setKaijiLine("nearMiss");
    els?.gameScreen?.classList.add("near-miss");
    this.showFloatText(`あと${dVal - pVal}…！`, "near-miss-text");
    if (this.vignette) this.vignette.classList.add("active");
    setTimeout(() => {
      els?.gameScreen?.classList.remove("near-miss");
      this.vignette?.classList.remove("active");
    }, 1400);
  },

  /* ---------- 連勝・大勝 (#6) ---------- */
  onStreak(streak) {
    if (streak === 3) {
      els?.gameScreen?.classList.add("streak-3");
      this.showFloatText("3連勝！", "streak-text");
    }
    if (streak >= 5) {
      els?.gameScreen?.classList.add("streak-5");
      this.coinRain(16);
      this.showFloatText(`${streak}連勝！！`, "streak-text big");
    }
  },

  onBigWin(net) {
    if (net >= 5000) {
      this.coinRain(28);
      els?.gameScreen?.classList.add("big-win-flash");
      setTimeout(() => els?.gameScreen?.classList.remove("big-win-flash"), 1200);
    }
  },

  coinRain(count = 20) {
    if (!this.layer) return;
    for (let i = 0; i < count; i++) {
      const c = document.createElement("div");
      c.className = "fly-coin rain";
      c.style.left = `${10 + Math.random() * 80}%`;
      c.style.animationDelay = `${Math.random() * 0.6}s`;
      c.style.animationDuration = `${0.8 + Math.random() * 0.6}s`;
      this.layer.appendChild(c);
      setTimeout(() => c.remove(), 2000);
    }
  },

  showFloatText(text, className = "float-text") {
    if (!this.layer) return;
    const el = document.createElement("div");
    el.className = className;
    el.textContent = text;
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  },

  /* ---------- コイン飛翔（勝敗時 → HUD） ---------- */
  flyCoinsToHud(amount, isWin) {
    if (!this.layer || !els?.bankroll) return;
    const hr = els.bankroll.getBoundingClientRect();
    const count = Math.min(8, Math.max(3, Math.floor(amount / 500)));
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const c = document.createElement("div");
        c.className = "fly-coin" + (isWin ? "" : " lose");
        c.style.left = `${hr.left + (Math.random() - 0.5) * 40}px`;
        c.style.top = `${hr.top - 80 - Math.random() * 40}px`;
        this.layer.appendChild(c);
        requestAnimationFrame(() => {
          c.style.left = `${hr.left + hr.width / 2}px`;
          c.style.top = `${hr.top + hr.height / 2}px`;
          c.classList.add("arrived");
        });
        setTimeout(() => c.remove(), 650);
      }, i * 70);
    }
    els.bankroll.classList.add(isWin ? "pulse-win" : "pulse-lose");
    setTimeout(() => els.bankroll.classList.remove("pulse-win", "pulse-lose"), 500);
  },

  /* ---------- カード演出 (#1) ---------- */
  async dealInitialHands(renderCardFn, playerHand, dealerHand, containers) {
    const { playerCards, dealerCards } = containers;
    playerCards.innerHTML = "";
    dealerCards.innerHTML = "";

    const sequence = [
      { hand: playerHand, i: 0, container: playerCards, hidden: false },
      { hand: dealerHand, i: 0, container: dealerCards, hidden: false },
      { hand: playerHand, i: 1, container: playerCards, hidden: false },
      { hand: dealerHand, i: 1, container: dealerCards, hidden: true },
    ];

    for (const step of sequence) {
      const card = step.hand[step.i];
      const el = renderCardFn(card, step.hidden, true);
      step.container.appendChild(el);
      Sound?.play("deal");
      await this.delay(320);
    }
    updateScores(true);
  },

  async flipDealerHoleCard() {
    const hole = els?.dealerCards?.querySelector(".card--hole");
    if (!hole || !dealerHand?.[1]) return;
    await this.eventHoleReveal();
    hole.classList.add("flipping");
    Sound?.play("hit");
    await this.delay(350);
    const card = dealerHand[1];
    hole.classList.remove("hidden", "card--hole", "flipping");
    const isRed = RED_SUITS.has(card.suit);
    hole.classList.add(isRed ? "red" : "black");
    hole.innerHTML = `<span class="rank">${card.rank}</span><span class="suit">${card.suit}</span>`;
    updateScores(false);
    await this.delay(200);
  },

  async appendDealerCardAnimated(renderCardFn, card) {
    const el = renderCardFn(card, false, true);
    els.dealerCards.appendChild(el);
    Sound?.play("dealerHit");
    updateScores(false);
    await this.delay(350);
  },

  async appendPlayerCardAnimated(renderCardFn, card) {
    const el = renderCardFn(card, false, true);
    els.playerCards.appendChild(el);
    Sound?.play("hit");
    updateScores(true);
    await this.delay(280);
  },

  /* ---------- ざわざわ・緊張演出 ---------- */
  getZawazawaChance(bonus = 0) {
    let c = 0.2 + bonus;
    if (this.rushActive) c += 0.1;
    if (typeof currentBet !== "undefined" && currentBet >= 2500) c += 0.06;
    return Math.min(0.5, c);
  },

  async maybeZawazawa(bonus = 0) {
    if (Math.random() < this.getZawazawaChance(bonus)) {
      await this.playZawazawa();
      return true;
    }
    return false;
  },

  async playZawazawa() {
    if (!els?.gameTable) return;
    this.tensionPulse();
    const overlay = document.createElement("div");
    overlay.className = "zawazawa-overlay";
    overlay.innerHTML =
      '<span class="zaw-text">ざわ…</span><span class="zaw-text zaw-delay">ざわざわ……</span>';
    els.gameTable.appendChild(overlay);
    setKaijiLine("tension");
    Sound?.play("zawazawa");
    await this.delay(1600);
    overlay.remove();
    this.tensionEnd();
  },

  tensionPulse() {
    if (this.vignette) this.vignette.classList.add("active", "tension");
    els?.gameScreen?.classList.add("tension-vignette");
  },

  tensionEnd() {
    this.vignette?.classList.remove("active", "tension");
    els?.gameScreen?.classList.remove("tension-vignette");
  },

  /* ---------- イベント演出（ワクワク） ---------- */
  eventAllIn() {
    els?.gameScreen?.classList.add("event-allin");
    this.showFloatText("═══ ALL IN ═══", "event-text allin");
    setKaijiLine("allInEvent");
    Sound?.play("zawazawa");
    setTimeout(() => els?.gameScreen?.classList.remove("event-allin"), 1400);
  },

  eventBigBet() {
    this.showFloatText("大勝負のベット…！", "event-text bigbet");
    els?.gameScreen?.classList.add("event-bigbet");
    setTimeout(() => els?.gameScreen?.classList.remove("event-bigbet"), 900);
  },

  eventDangerZone(val) {
    this.showFloatText(`${val}…一歩が生死を分ける`, "event-text danger");
    els?.playerArea?.classList.add("danger-pulse");
    setKaijiLine("danger");
    setTimeout(() => els?.playerArea?.classList.remove("danger-pulse"), 1000);
    void this.maybeZawazawa(0.15);
  },

  eventRiskyHand(val) {
    this.showFloatText(`${val}…次が運命の一枚`, "event-text risky");
    els?.playerArea?.classList.add("risky-pulse");
    setTimeout(() => els?.playerArea?.classList.remove("risky-pulse"), 700);
  },

  async eventStandoff(pVal) {
    this.showFloatText(`スタンド ${pVal} — 勝負は相手次第`, "event-text standoff");
    setKaijiLine("standoff");
    await this.delay(400);
    await this.maybeZawazawa(0.08);
  },

  async eventHoleReveal() {
    this.showFloatText("…裏の札、開示", "event-text suspense");
    this.tensionPulse();
    await this.delay(450);
    if (!(await this.maybeZawazawa(0.12))) {
      Sound?.play("zawazawa");
      await this.delay(500);
    }
    this.tensionEnd();
  },

  async eventShowdown(pVal, dVal) {
    if (pVal > 21 || dVal > 21) return;
    const diff = Math.abs(pVal - dVal);
    if (diff > 3) return;
    els?.gameTable?.classList.add("showdown-shake");
    const msg = diff === 0 ? "同点…どちらが上か" : `僅差 ${diff}…決着の瞬間`;
    this.showFloatText(msg, "event-text showdown");
    setKaijiLine("showdown");
    Sound?.play("zawazawa");
    await this.delay(700);
    els?.gameTable?.classList.remove("showdown-shake");
    if (diff <= 1) await this.maybeZawazawa(0.2);
  },

  eventDoubleDown() {
    this.showFloatText("ダブル…全てをこの一手に", "event-text double");
    setKaijiLine("doubleDown");
    els?.gameScreen?.classList.add("event-double");
    setTimeout(() => els?.gameScreen?.classList.remove("event-double"), 900);
    void this.maybeZawazawa(0.1);
  },

  eventLucky21() {
    this.showFloatText("21…完璧な一手！", "event-text lucky");
    this.coinRain(10);
  },

  /* ---------- 勝敗・イーブン演出 ---------- */
  async onRoundOutcome(result, net, opts = {}) {
    const isPush = result === "push";
    const isWin = !isPush && net > 0;
    const skipBanner = opts.skipBanner;

    if (isWin) {
      await this.playOutcomeWin(result, net, skipBanner);
    } else if (isPush) {
      await this.playOutcomePush(skipBanner);
    } else {
      await this.playOutcomeLose(result, net, skipBanner);
    }
  },

  async playOutcomeWin(result, net, skipBanner) {
    els?.gameScreen?.classList.add("outcome-win-active");
    els?.playerArea?.classList.add("outcome-area-win");

    if (!skipBanner) {
      const sub =
        result === "blackjack"
          ? "ブラックジャック！"
          : result === "dealerBust"
            ? "ディーラーバースト"
            : `+${formatCoins(net)} コイン`;
      await this.showOutcomeBanner("WIN", sub, "win");
    } else {
      this.showFloatText(`+${formatCoins(net)}`, "outcome-float win");
      await this.delay(900);
    }

    this.flyCoinsToHud(net, true);
    if (net >= 1500) this.coinRain(Math.min(20, 6 + Math.floor(net / 800)));

    Sound?.playOutcomeWin(typeof lastBetTier !== "undefined" ? lastBetTier : "mid");
    await this.delay(skipBanner ? 400 : 200);
    els?.gameScreen?.classList.remove("outcome-win-active");
    els?.playerArea?.classList.remove("outcome-area-win");
  },

  async playOutcomeLose(result, net, skipBanner) {
    const loss = Math.abs(net) || (typeof currentBet !== "undefined" ? currentBet : 0);
    els?.gameScreen?.classList.add("outcome-lose-active");
    els?.playerArea?.classList.add("outcome-area-lose");

    if (!skipBanner) {
      const sub =
        result === "bust"
          ? "バースト"
          : isTwentyOne(dealerHand)
            ? "ディーラー21点"
            : `-${formatCoins(loss)} コイン`;
      await this.showOutcomeBanner("LOSE", sub, "lose");
    } else {
      this.showFloatText(`-${formatCoins(loss)}`, "outcome-float lose");
      await this.delay(900);
    }

    this.flyCoinsToHud(loss, false);
    if (result !== "bust") Sound?.playOutcomeLose();

    await this.delay(skipBanner ? 400 : 200);
    els?.gameScreen?.classList.remove("outcome-lose-active");
    els?.playerArea?.classList.remove("outcome-area-lose");
  },

  async playOutcomePush(skipBanner) {
    els?.gameScreen?.classList.add("outcome-push-active");
    els?.gameTable?.classList.add("outcome-table-push");

    if (!skipBanner) {
      await this.showOutcomeBanner("EVEN", "引き分け — ベット返還", "push");
    } else {
      this.showFloatText("EVEN — 引き分け", "outcome-float push");
      await this.delay(900);
    }

    Sound?.playOutcomeEven();
    await this.delay(skipBanner ? 400 : 200);
    els?.gameScreen?.classList.remove("outcome-push-active");
    els?.gameTable?.classList.remove("outcome-table-push");
  },

  async showOutcomeBanner(title, subtitle, type) {
    if (!this.layer) {
      await this.delay(1200);
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = `outcome-overlay outcome-${type}`;
    wrap.innerHTML = `
      <div class="outcome-flash" aria-hidden="true"></div>
      <div class="outcome-banner">
        <span class="outcome-title">${title}</span>
        <span class="outcome-sub">${subtitle}</span>
      </div>
    `;
    this.layer.appendChild(wrap);

    await this.delay(type === "push" ? 1400 : 1600);
    wrap.classList.add("outcome-fade");
    await this.delay(350);
    wrap.remove();
  },

  clearEventClasses() {
    els?.gameScreen?.classList.remove(
      "event-allin",
      "event-bigbet",
      "event-double",
      "near-miss",
      "big-win-flash",
      "streak-3",
      "streak-5",
      "tension-vignette",
      "rush-mode",
      "outcome-win-active",
      "outcome-lose-active",
      "outcome-push-active"
    );
    els?.gameTable?.classList.remove("showdown-shake", "table-rush", "outcome-table-push");
    els?.playerArea?.classList.remove("danger-pulse", "risky-pulse", "outcome-area-win", "outcome-area-lose");
  },

  resetSession() {
    this.heat = 20;
    this.lossStreak = 0;
    this.roundsPlayed = 0;
    this.exitRush();
    this.updateHeatUI();
  },
};
