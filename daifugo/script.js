const cardPlaySound = new Audio('card_play.mp3');
const cardPlaySound2 = new Audio('card_play2.mp3');
const raiseSound = new Audio('raise_se.mp3');
const zawaSound = new Audio('zawazawa.wav');

const gameBgm = new Audio('bgm.mp3');
gameBgm.loop = true;
gameBgm.volume = 0.30;

const betBgm = new Audio('bet_bgm.mp3'); 
betBgm.loop = true;
betBgm.volume = 0.3;

//全音声の一元管理用リスト
const allSounds = [cardPlaySound, cardPlaySound2, raiseSound, gameBgm, betBgm];

//画面右上の音量スライダーのリアルタイム変更イベント
document.addEventListener("DOMContentLoaded", () => {
    const volSlider = document.getElementById("global-volume-slider");
    const volValText = document.getElementById("global-volume-val");

    if (volSlider && volValText) {
        volSlider.oninput = (e) => {
            const volume = parseFloat(e.target.value);
            
            // すべての音声ファイルの音量を一括書き換え
            allSounds.forEach(sound => {
                sound.volume = volume;
            });
            
            // ％表記のテキストを更新（例: 0.3 -> 30%）
            volValText.innerText = Math.round(volume * 100) + "%";
        };
    }
});

// CPUの10捨て自動処理
function cpuTenDiscard() {
    if (!gameState.tenDiscardMode) return;
    // 弱いカードから優先して捨てる
    let discard = gameState.cpuHand.slice(0, gameState.tenDiscardCount);
    gameState.cpuHand = gameState.cpuHand.filter((_, i) => i >= gameState.tenDiscardCount);
    gameState.tenDiscardMode = false;
    gameState.tenDiscardCount = 0;
    gameState.tenDiscardSelected = [];
    showMessage(`CPUが${discard.length}枚捨てました`);
    renderHand();
    checkWin("CPU");
    if (!gameState.isGameOver) setTimeout(() => {
        showMessage("あなたの番です。");
        renderHand();
    }, 800);
}
// 10捨てUI表示
function renderTenDiscardUI() {
    const handDiv = document.getElementById("player-hand");
    handDiv.innerHTML = "";
    gameState.playerHand.forEach((card, index) => {
        const cardEl = createCardElement(card, index, true);
        // 10捨て選択用の挙動
        cardEl.onclick = () => toggleTenDiscardSelect(index, cardEl);
        if (gameState.tenDiscardSelected.includes(index)) {
            cardEl.classList.add('selected');
        }
        handDiv.appendChild(cardEl);
    });
    // 決定ボタン
    let confirmBtn = document.getElementById("ten-discard-btn");
    if (!confirmBtn) {
        confirmBtn = document.createElement("button");
        confirmBtn.id = "ten-discard-btn";
        confirmBtn.innerText = "このカードで捨てる";
        confirmBtn.style.marginLeft = "16px";
        handDiv.parentNode.appendChild(confirmBtn);
    }
    confirmBtn.onclick = confirmTenDiscard;
}

function toggleTenDiscardSelect(index, element) {
    if (!gameState.tenDiscardMode) return;
    if (element.classList.contains("selected")) {
        element.classList.remove("selected");
        gameState.tenDiscardSelected = gameState.tenDiscardSelected.filter(i => i !== index);
        return;
    }
    if (gameState.tenDiscardSelected.length >= gameState.tenDiscardCount) {
        showMessage(`${gameState.tenDiscardCount}枚まで選択できます`);
        return;
    }
    element.classList.add("selected");
    gameState.tenDiscardSelected.push(index);
}

function confirmTenDiscard() {
    if (gameState.tenDiscardSelected.length !== gameState.tenDiscardCount) {
        showMessage(`${gameState.tenDiscardCount}枚選んでください`);
        return;
    }
    // 選択したカードを手札から削除
    gameState.playerHand = gameState.playerHand.filter((_, i) => !gameState.tenDiscardSelected.includes(i));
    gameState.tenDiscardMode = false;
    gameState.tenDiscardCount = 0;
    gameState.tenDiscardSelected = [];
    // 10捨てUIを消す
    const btn = document.getElementById("ten-discard-btn");
    if (btn) btn.remove();
    renderHand();
    checkWin("Player");
    if (!gameState.isGameOver) setTimeout(cpuTurn, 1000);
}
// 定数と初期設定
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1, 2]; // 大富豪の強さ順
const JOKER_RANK = "JKR";
const JOKER_SUIT = "🃏";

// ゲーム状態 
let gameState = {
    deck: [],
    playerHand: [],
    cpuHand: [],
    lastPlayed: { rank: 0, count: 0 },
    selectedCards: [],
    isRevolution: false,
    isElevenBack: false,
    isGameOver: false,
    skipNext: null,
    tenDiscardMode: false, // 10捨て中か
    tenDiscardCount: 0,    // 捨てる枚数
    tenDiscardSelected: [], // プレイヤーが選択した捨て札

    pelika: parseInt(localStorage.getItem('bugging_cash')) || 100000000, 
    currentBet: 10000000
};

// カード操作ユーティリティ
function createDeck() {
    const deck = [];
    SUITS.forEach(suit => {
        RANKS.forEach(rank => {
            deck.push({ suit, rank });
        });
    });
    // ジョーカーを2枚追加
    deck.push({ suit: JOKER_SUIT, rank: JOKER_RANK });
    deck.push({ suit: JOKER_SUIT, rank: JOKER_RANK });
    return deck;
}

function shuffleDeck(deck) {
    return [...deck].sort(() => Math.random() - 0.5);
}

function sortHand(hand) {
    return hand.sort((a, b) => {
        if (a.rank === JOKER_RANK) return -1;
        if (b.rank === JOKER_RANK) return 1;
        return RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
    });
}

function isJoker(card) {
    return card.rank === JOKER_RANK;
}

function getMainCard(cards) {
    const nonJokerCards = cards.filter(c => !isJoker(c));
    return nonJokerCards.length > 0 ? nonJokerCards[0] : cards[0];
}

function compareRanks(rank1, rank2) {
    // ジョーカーは最強
    if (rank1 === JOKER_RANK) return true;
    if (rank2 === JOKER_RANK) return false;
    
    const index1 = RANKS.indexOf(rank1);
    const index2 = RANKS.indexOf(rank2);
    
    if (gameState.isRevolution || gameState.isElevenBack) {
        return index1 < index2; // 革命中または11バック中は逆転
    } else {
        return index1 > index2; // 通常時
    }
}

// UI操作
function createCardElement(card, index, isClickable = true) {
    const cardEl = document.createElement("div");
    cardEl.className = "card";
    
    // ハートとダイヤを赤色に
    if (card.suit === "♥" || card.suit === "♦") {
        cardEl.classList.add("red");
    }
    
    // ジョーカーを特別表示
    if (isJoker(card)) {
        cardEl.innerText = "Joker";
        cardEl.style.backgroundColor = "#ffeb3b";
        cardEl.style.color = "#000";
    } else {
        cardEl.innerText = `${card.suit}${card.rank}`;
    }
    
    // プレイヤーのターンがスキップされている場合はクリックを無効化
    if (isClickable && !gameState.isGameOver && gameState.skipNext !== 'player') {
        cardEl.onclick = () => toggleSelect(index, cardEl);
        // 再描画時に選択状態を反映する
        if (typeof index === 'number' && gameState.selectedCards.includes(index)) {
            cardEl.classList.add('selected');
        }
    }
    
    return cardEl;
}

function renderHand() {
    const handDiv = document.getElementById("player-hand");
    handDiv.innerHTML = "";
    
    gameState.playerHand.forEach((card, index) => {
        const cardEl = createCardElement(card, index);
        handDiv.appendChild(cardEl);
    });
    
    document.getElementById("cpu-count").innerText = gameState.cpuHand.length;
}

function updateField(cards) {
    const field = document.getElementById("field-cards");
    field.innerHTML = "";
    
    cards.forEach(card => {
        const cardEl = createCardElement(card, null, false);
        field.appendChild(cardEl);
    });
}

function updateRevolutionStatus() {
    const statusEl = document.getElementById("revolution-status");
    if (gameState.isElevenBack) {
        statusEl.innerText = "11バック発動中！";
        statusEl.style.color = "#42a5f5";
    } else if (gameState.isRevolution) {
        statusEl.innerText = "革命発動中！強さ関係が逆転！";
        statusEl.style.color = "#ff6b6b";
    } else {
        statusEl.innerText = "";
    }
}

function resetTemporaryRevolution() {
    if (gameState.isElevenBack) {
        gameState.isElevenBack = false;
        updateRevolutionStatus();
    }
}

function showMessage(message) {
    const msgEl = document.getElementById("msg");
    msgEl.innerText = message;
    msgEl.classList.add("visible");

    if (window._msgTimeout) clearTimeout(window._msgTimeout);
    if (window._msgHideTimeout) clearTimeout(window._msgHideTimeout);

    window._msgTimeout = setTimeout(() => {
        if (!gameState.isGameOver) {
            msgEl.classList.remove("visible");
            window._msgHideTimeout = setTimeout(() => {
                msgEl.innerText = "";
                window._msgHideTimeout = null;
            }, 300);
        }
        window._msgTimeout = null;
    }, 1000);
}

function showResult(message) {
    const msgEl = document.getElementById("msg");
    msgEl.innerText = message;
    msgEl.classList.add("visible");
    msgEl.classList.add("result");
    
    // 💡 通常のメッセージ自動消去タイマーを完全に止める（結果を画面に残すため）
    if (window._msgTimeout) clearTimeout(window._msgTimeout);
    if (window._msgHideTimeout) clearTimeout(window._msgHideTimeout);
}

function setGameOver() {
    gameState.isGameOver = true;
    document.getElementById("play-btn").disabled = true;
    document.getElementById("pass-btn").disabled = true;
}

//　カード選択ロジック
function toggleSelect(index, element) {
    if (gameState.isGameOver || gameState.tenDiscardMode) return; // 10捨て中は通常選択不可
    if (element.classList.contains("selected")) {
        element.classList.remove("selected");
        gameState.selectedCards = gameState.selectedCards.filter(i => i !== index);
        return;
    }
    
    const selectedCard = gameState.playerHand[index];
    
    if (!canSelectCard(selectedCard)) {
        return;
    }
    
    element.classList.add("selected");
    gameState.selectedCards.push(index);
}

function canSelectCard(card) {
    // 選択済みカードの実体を取得
    const selectedCards = gameState.selectedCards.map(i => gameState.playerHand[i]);
    const hasJoker = selectedCards.some(c => isJoker(c));
    const nonJokerCards = selectedCards.filter(c => !isJoker(c));
    const nonJokerRanks = [...new Set(nonJokerCards.map(c => c.rank))];

    if (isJoker(card)) {
        if (nonJokerRanks.length <= 1) {
            return true;
        }
        showMessage("ジョーカーは同じ数字のカードとしか組み合わせられません");
        return false;
    }

    if (hasJoker) {
        if (nonJokerRanks.length === 0 || nonJokerRanks[0] === card.rank) {
            return true;
        }
        showMessage("ジョーカーと組み合わせるには同じ数字のカードが必要です");
        return false;
    }

    if (nonJokerRanks.length > 0 && !nonJokerRanks.includes(card.rank)) {
        showMessage("同じ数字のカードのみ選べます");
        return false;
    }

    return true;
}

function initGame() {
    gameState.deck = shuffleDeck(createDeck());
    gameState.playerHand = sortHand(gameState.deck.slice(0, 14));
    gameState.cpuHand = sortHand(gameState.deck.slice(14, 28));
    gameState.lastPlayed = { rank: 0, count: 0 };
    gameState.selectedCards = [];
    gameState.isRevolution = false;
    gameState.isGameOver = false;
    gameState.skipNext = null;
    
    // UIの初期化
    document.getElementById("play-btn").disabled = true; 
    document.getElementById("pass-btn").disabled = true; 
    const msgEl = document.getElementById("msg");
    msgEl.classList.remove("visible", "result");
    msgEl.innerText = "";
    
    updateRevolutionStatus();
    renderHand();

    // 【ここを調整】破産チェック（最低賭け金が1000万ペリカになったので、未満なら1億にリセット）
    if (!gameState.pelika || gameState.pelika < 10000000) {
        alert("破産……！地下強制労働行き……！\n\n（新たな軍資金として、1億ペリカを支給して復活します）");
        gameState.pelika = 100000000; // 初期値を1億ペリカに
        localStorage.setItem('bugging_cash', gameState.pelika);
    }
    
    // 所持ペリカの画面表示
    document.getElementById("player-pelika").innerText = Number(gameState.pelika).toLocaleString();

    // ベット用UIを表示し、メインのゲーム画面を半透明化
    document.getElementById("bet-setup-area").style.display = "block";
    document.getElementById("game-container").style.opacity = "0.5";
    
    // スライダーを1000万ペリカ単位で全額まで動かせるように設定
    const maxBet = gameState.pelika; // 上限は現在の所持金すべて
    const slider = document.getElementById("bet-slider");
    
    slider.min = "10000000";         //  最低賭け金を 1,000万 ペリカに設定
    slider.max = String(maxBet);    //  上限は自分の所持金全額
    slider.step = "10000000";       // つまみを動かしたときの単位を 1,000万 ペリカ刻みに変更
    slider.value = "10000000";      // 初期値を 1,000万 ペリカに設定
    
    document.getElementById("bet-slider-val").innerText = "10,000,000"; 
    document.getElementById("current-bet-display").innerText = "10,000,000";

    betBgm.play().catch(e => console.log("BGM再生エラー（ユーザー操作前）:", e));
}

function canPlayCards(cards) {
    const mainCard = getMainCard(cards);
    const isValidCount = gameState.lastPlayed.count === 0 || cards.length === gameState.lastPlayed.count;
    const isValidRank = gameState.lastPlayed.count === 0 || compareRanks(mainCard.rank, gameState.lastPlayed.rank);
    
    return isValidCount && isValidRank;
}

function handleSpecialCards(cards, isPlayer = true) {
    const mainCard = getMainCard(cards);
    const hasJoker = cards.some(isJoker);
    const nonJokerCards = cards.filter(c => !isJoker(c));
    
        // 大革命判定
        if (cards.length === 4 && cards.every(c => c.rank === 2)) {
            showMessage("大革命！無条件勝利！");
            gameState.superRevolution = true;
            return false;
        }
        // ラッキー７判定
        if (cards.length === 3 && cards.every(c => c.rank === 7)) {
            showMessage("ラッキー７！");
            gameState.lucky7 = true;
            return true; // ここでtrueを返すことでplayCardsで即returnできる
    }

    // 革命チェック
    if (cards.length >= 4) {
        gameState.isRevolution = !gameState.isRevolution;
        updateRevolutionStatus();
        const revolutionMsg = gameState.isRevolution ? 
            "革命！強さ関係が逆転しました！" : 
            "革命が終わり、通常の強さ関係に戻りました！";
        showMessage(revolutionMsg);
    }
    

    // 10捨てチェック
    if (mainCard.rank === 10) {
    gameState.tenDiscardMode = true;
    
    if (isPlayer) {
        // 出した枚数と、自分の現在の残り手札の「少ない方」を捨てる目標枚数にする
        gameState.tenDiscardCount = Math.min(cards.length, gameState.playerHand.length);
        gameState.tenDiscardSelected = [];
        
        showMessage(`10捨て発動！手札から ${gameState.tenDiscardCount} 枚捨ててください`);
        renderTenDiscardUI();
    } else {
        // CPU側も残り手札の枚数を超えないように制限
        gameState.tenDiscardCount = Math.min(cards.length, gameState.cpuHand.length);
        gameState.tenDiscardSelected = [];
        setTimeout(cpuTenDiscard, 800);
    }
    return true; 
}

    // 8切りチェック
    if (mainCard.rank === 8) {
        showMessage("8切り！" + (isPlayer ? "あなたの番です。" : "CPUの番です。"));
        // 場にカードは一度表示した後、短時間で流す（カードが見えるように遅延）
        setTimeout(() => {
            gameState.lastPlayed = { rank: 0, count: 0 };
            const field = document.getElementById("field-cards");
            if (field) field.innerHTML = "流されました";

            cardPlaySound2.play().catch(error => {
                console.log("音声を再生できませんでした（ユーザーの操作が必要です）:", error);
            });

            resetTemporaryRevolution();
        }, 600);
        return true; // 8切り発生
    }

    // 11バックチェック
    if (mainCard.rank === 11) {
        gameState.isElevenBack = true;
        updateRevolutionStatus();
        showMessage("11バック！一時的な革命状態");
    }

    // 5スキップチェック
    if (mainCard.rank === 5) {
        // 次の相手ターンをスキップする
        gameState.skipNext = isPlayer ? 'cpu' : 'player';
        // 場はリセットしない（そのまま維持する）
        if (isPlayer) {
            showMessage("5スキップ！あなたの番です。");
        } else {
            showMessage("5スキップ！\nあなたのターンがスキップされました");
        }
        return false;
    }
    
    // メッセージ表示
    if (hasJoker && nonJokerCards.length === 0) {
        showMessage((isPlayer ? "" : "CPUが") + "ジョーカーを出しました！");
    } else if (hasJoker) {
        showMessage((isPlayer ? "" : "CPUが") + `${mainCard.suit}${mainCard.rank}とジョーカーを出しました！`);
    } else {
        showMessage((isPlayer ? "" : "CPUが") + `${mainCard.suit}${mainCard.rank}を出しました！`);
    }
    
    return false; // 8切りなし
}

function playCards(cards, isPlayer = true) {
    const mainCard = getMainCard(cards);
    
// カードを出すたびに音を再生
    cardPlaySound.play().catch(error => {
        console.log("音声を再生できませんでした（ユーザーの操作が必要です）:", error);
    });

    if (isPlayer) {
        showZawaZawaEffect();
    }

    // 大革命判定
    if (cards.length === 4 && cards.every(c => c.rank === 2)) {
        showMessage("大革命！無条件勝利！");
        gameState.superRevolution = true;
    }
    // ラッキー７判定
    else if (cards.length === 3 && cards.every(c => c.rank === 7)) {
        showMessage("ラッキー７！");
        gameState.lucky7 = true;
    }

    gameState.lastPlayed = { rank: mainCard.rank, count: cards.length };
    updateField(cards);

    // 出したカードを手札から削除
    if (isPlayer) {
        gameState.playerHand = gameState.playerHand.filter((_, i) => !gameState.selectedCards.includes(i));
        gameState.selectedCards = [];
        renderHand();
        // 特殊勝利フラグが立っている、または手札が0枚なら勝敗チェックへ
        if (gameState.superRevolution || gameState.lucky7 || gameState.playerHand.length === 0) {
            checkWin("Player");
            return;
        }
    } else {
        gameState.cpuHand = gameState.cpuHand.filter(c => !cards.includes(c));
        renderHand();
        if (gameState.superRevolution || gameState.lucky7 || gameState.cpuHand.length === 0) {
            checkWin("CPU");
            return;
        }
    }

    const isSpecial = handleSpecialCards(cards, isPlayer);
    if (isSpecial) {
        if (mainCard.rank === 8) {
            if (!isPlayer) {
                setTimeout(cpuTurn, 1500);
            }
        }
        return;
    }

    // 通常のターン継続処理
    if (isPlayer) {
        if (gameState.skipNext === 'cpu') {
            gameState.skipNext = null;
            renderHand();
        } else {
            setTimeout(cpuTurn, 1000);
        }
    } else {
        if (gameState.skipNext === 'player') {
            gameState.skipNext = null;
            showMessage("CPUが5を出しました：あなたのターンはスキップされます。");
            setTimeout(cpuTurn, 2000);
        }
    }
}

//プレイヤー操作
document.getElementById("play-btn").onclick = () => {
    if (gameState.isGameOver || gameState.selectedCards.length === 0) return;
    if (gameState.skipNext === 'player') {
        showMessage("あなたのターンはスキップされています。");
        return;
    }

    const cardsToPlay = gameState.selectedCards.map(i => gameState.playerHand[i]);

    if (canPlayCards(cardsToPlay)) {
        playCards(cardsToPlay, true);
    } else {
        showMessage("そのカードは出せません");
    }
};

document.getElementById("pass-btn").onclick = () => {
    if (gameState.isGameOver) return;
    if (gameState.skipNext === 'player') {
        showMessage("あなたのターンはスキップされています。");
        return;
    }
    resetTemporaryRevolution();
    gameState.lastPlayed = { rank: 0, count: 0 };
    document.getElementById("field-cards").innerHTML = "流されました";

    cardPlaySound2.play().catch(error => {
        console.log("音声を再生できませんでした（ユーザーの操作が必要です）:", error);
    });
    setTimeout(cpuTurn, 1000);
};
// CPUロジック
function findPlayableCards(hand) {
    const playableCards = [];
    const joker = hand.find(isJoker);
    
    // 場が流れている場合
    if (gameState.lastPlayed.count === 0) {
        hand.forEach(card => {
            if (isJoker(card)) {
                if (!playableCards.find(c => c.rank === JOKER_RANK)) {
                    playableCards.push({ rank: JOKER_RANK, cards: [card] });
                }
            } else {
                const sameRanks = hand.filter(c => c.rank === card.rank);
                if (!playableCards.find(c => c.rank === card.rank)) {
                    playableCards.push({ rank: card.rank, cards: sameRanks });
                }
                
                // ジョーカーとの組み合わせ
                if (joker && sameRanks.length > 0 && sameRanks.length <= 3) {
                    const combinedCards = [...sameRanks, joker];
                    if (!playableCards.find(c => c.rank === card.rank && c.cards.length === combinedCards.length)) {
                        playableCards.push({ rank: card.rank, cards: combinedCards });
                    }
                }
            }
        });
    } else {
        // 場にカードがある場合
        hand.forEach(card => {
            if (isJoker(card)) {
                // ジョーカーは場の枚数が1枚の時のみ出せる
                if (gameState.lastPlayed.count === 1 && 
                    !playableCards.find(c => c.rank === JOKER_RANK)) {
                    playableCards.push({ rank: JOKER_RANK, cards: [card] });
                }
            } else {
                const sameRanks = hand.filter(c => c.rank === card.rank);
                
                // 同じ数字カードのみ（枚数が一致する場合のみ）
                if (sameRanks.length === gameState.lastPlayed.count && 
                    compareRanks(card.rank, gameState.lastPlayed.rank)) {
                    if (!playableCards.find(c => c.rank === card.rank)) {
                        playableCards.push({ rank: card.rank, cards: sameRanks });
                    }
                }
                
                // ジョーカーとの組み合わせ（枚数が一致する場合のみ）
                if (joker && sameRanks.length > 0 && 
                    sameRanks.length + 1 === gameState.lastPlayed.count && 
                    gameState.lastPlayed.count <= 4 && 
                    compareRanks(card.rank, gameState.lastPlayed.rank)) {
                    const combinedCards = [...sameRanks, joker];
                    if (!playableCards.find(c => c.rank === card.rank && c.cards.length === combinedCards.length)) {
                        playableCards.push({ rank: card.rank, cards: combinedCards });
                    }
                }
            }
        });
    }
    
    return playableCards;
}

function selectBestCard(playableCards) {
    // 革命状態や11バック中は強さが逆転するので、弱い手から出すようにする
    playableCards.sort((a, b) => {
        // ジョーカーは最後に使う
        if (a.rank === JOKER_RANK) return 1;
        if (b.rank === JOKER_RANK) return -1;
        
        if (gameState.isRevolution || gameState.isElevenBack) {
            return RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank);
        } else {
            return RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
        }
    });
    
    return playableCards[0];
}

function cpuTurn() {
    if (gameState.isGameOver) return;
    const playableCards = findPlayableCards(gameState.cpuHand);
    
    if (playableCards.length > 0) {
        const selected = selectBestCard(playableCards);
        playCards(selected.cards, false);
    } else {
        resetTemporaryRevolution();
        gameState.lastPlayed = { rank: 0, count: 0 };
        document.getElementById("field-cards").innerHTML = "流されました";

        cardPlaySound2.play().catch(error => {
            console.log("音声を再生できませんでした（ユーザーの操作が必要です）:", error);
        });

        showMessage("CPUがパスしました。あなたの番です。");
        renderHand();
        checkWin("CPU");
    }
}

function checkWin(playerName) {
    if (gameState.playerHand.length === 0 || ((gameState.superRevolution || gameState.lucky7) && playerName === "Player")) {
        setGameOver();
        
        let multiplier = 2;
        let winReason = "勝利……！";
        
        if (gameState.superRevolution) {
            multiplier = 100; 
            winReason = "圧倒的大革命勝利……っ！！(100倍)";
        } else if (gameState.lucky7) {
            multiplier = 70;
            winReason = "ラッキー7奇跡の勝利……っ！！(70倍)";
        } else if (gameState.isRevolution) {
            multiplier = 4;
            winReason = "革命勝利……っ！！(4倍)";
        }

        let winAmount = gameState.currentBet * multiplier;
        gameState.pelika += winAmount;
        localStorage.setItem('bugging_cash', gameState.pelika);
        
        // フラグをリセット
        gameState.superRevolution = false;
        gameState.lucky7 = false;
        
        document.getElementById("player-pelika").innerText = gameState.pelika.toLocaleString();
        showResult(`🎉 ${winReason}\n【+${winAmount.toLocaleString()} ペリカ】を獲得……！`);
        showEndGameChoices(); 
        return;
    }
    
    // CPUの勝利条件（通常勝利、またはCPUの手番での特殊勝利）
    if (gameState.cpuHand.length === 0 || ((gameState.superRevolution || gameState.lucky7) && playerName === "CPU")) {
        setGameOver();
        
        let multiplier = 2;
        let lossReason = "CPUの勝ち……！";

        if (gameState.superRevolution) {
            multiplier = 100; 
            lossReason = "CPUの圧倒的大革命勝利……っ！！(100倍)";
        } else if (gameState.lucky7) {
            multiplier = 70;
            lossReason = "CPUのラッキー7勝利……っ！！(70倍)";
        } else if (gameState.isRevolution) {
            multiplier = 4;
            lossReason = "CPUの革命勝利……っ！！(4倍)";
        }
        
        let lossAmount = gameState.currentBet * multiplier;
        gameState.pelika -= lossAmount;
        localStorage.setItem('bugging_cash', gameState.pelika);
        
        // フラグをリセット
        gameState.superRevolution = false;
        gameState.lucky7 = false;
        
        document.getElementById("player-pelika").innerText = gameState.pelika.toLocaleString();
        showResult(`💻 ${lossReason}\n【-${lossAmount.toLocaleString()} ペリカ】猛省せよ……！`);
        if (gameState.pelika < 10000000) {
            setTimeout(() => {
                
                // 次回のためにペリカを初期の1億に戻してセーブしておく
                localStorage.setItem('bugging_cash', 100000000);
                
                // 強制的に退出
                window.location.href = '../home/home.html';
            }, 1500); 
            return; 
        }
        if (gameState.pelika >= 24000000000) {
            setTimeout(() => {

                // 次回のためにペリカを初期の1億に戻してセーブしておく
                localStorage.setItem('bugging_cash', 100000000);
                
                // 強制的に退出
                window.location.href = '../home/home.html';
            }, 1500); 
            return; 
        }
        showEndGameChoices(); 
    }
}

// 「ホームへ戻る」ボタンを押したときの処理
document.getElementById('homeBtn').addEventListener('click', () => {
    // 1. ゲーム進行中の場合は確認ダイアログを出す
    if (!gameState.isGameOver) {
        const leave = confirm(`ゲームの途中ですが、ホーム画面に戻りますか？\n\n※今賭けている${gameState.currentBet.toLocaleString()} ペリカは没収されます`);
        if (!leave) return; // キャンセルされたら何もしない

        gameState.pelika -= gameState.currentBet;
        localStorage.setItem('bugging_cash', gameState.pelika);
    }

    // 2. 裏で動いているメッセージ用タイマー（setTimeout）を安全に停止
    if (window._msgTimeout) clearTimeout(window._msgTimeout);
    if (window._msgHideTimeout) clearTimeout(window._msgHideTimeout);

    // 3. ゲームを強制終了状態にして、これ以上のCPUの処理（10捨てやターン進行）の発生を防ぐ
    gameState.isGameOver = true;

    // 4. 指定のホーム画面へ遷移
    window.location.href = '../home/home.html'; 
});

//  ベットスライダーのリアルタイム表示変更
document.getElementById("bet-slider").oninput = (e) => {
    const val = parseInt(e.target.value);
    document.getElementById("bet-slider-val").innerText = val.toLocaleString();
};

// 「ゲーム開始」ボタンを押したときの処理
document.getElementById("start-with-bet-btn").onclick = () => {
    const selectedBet = parseInt(document.getElementById("bet-slider").value);

    raiseSound.play().catch(e => console.error("効果音再生エラー:", e));

    gameState.currentBet = selectedBet;
    document.getElementById("current-bet-display").innerText = selectedBet.toLocaleString() + " ペリカ";
    
    // ベット画面を隠してゲーム画面をアクティブにする
    document.getElementById("bet-setup-area").style.display = "none";
    document.getElementById("game-container").style.opacity = "1";
    
    // ゲーム用ボタンを有効化して勝負スタート！
    document.getElementById("play-btn").disabled = false;
    document.getElementById("pass-btn").disabled = false;
    showMessage("ゲーム開始……！ざわざわ……");
};

if (document.getElementById("bet-slider")) {
    document.getElementById("bet-slider").oninput = (e) => {
        const val = parseInt(e.target.value) || 10000000;
        document.getElementById("bet-slider-val").innerText = val.toLocaleString() + " ペリカ";
    };
}

// 💰 「ゲーム開始」ボタンの処理
if (document.getElementById("start-with-bet-btn")) {
    document.getElementById("start-with-bet-btn").onclick = () => {
        const selectedBet = parseInt(document.getElementById("bet-slider").value) || 10000000;
        
        raiseSound.play().catch(e => console.error("効果音再生エラー:", e));
        
        gameState.currentBet = selectedBet;
        document.getElementById("current-bet-display").innerText = selectedBet.toLocaleString();
        
        betBgm.pause();
        betBgm.currentTime = 0;

        gameBgm.play().catch(e => console.error("BGM再生エラー:", e));

        document.getElementById("bet-setup-area").style.display = "none";
        document.getElementById("game-container").style.opacity = "1";
        
        document.getElementById("play-btn").disabled = false;
        document.getElementById("pass-btn").disabled = false;
        showMessage("ゲーム開始……！ざわざわ……");

        //スタート画面に「hidden」クラスを付与してフェードアウトさせる
        const startScreen = document.getElementById("start-screen");
        if (startScreen) {
            startScreen.classList.add("hidden");
            
            // アニメーション（0.4秒）が終わった後に完全にDOMから非表示(display:none)にする
            setTimeout(() => {
                startScreen.style.display = "none";
            }, 400);
        }
    };
}

// ゲーム終了後に「もう一度」か「退出」かを選ばせるUIを生成する関数
function showEndGameChoices() {
    const controlsDiv = document.getElementById("controls");
    
    // 既存の「出す」「パス」ボタンを一旦見えなくする
    document.getElementById("play-btn").style.display = "none";
    document.getElementById("pass-btn").style.display = "none";
    
    // すでに選択ボタンが作られていなければ作成する
    if (!document.getElementById("retry-btn")) {
        const choiceArea = document.createElement("div");
        choiceArea.id = "end-choices";
        choiceArea.style.marginTop = "20px";
        choiceArea.style.display = "flex";
        choiceArea.style.justify = "center";
        choiceArea.style.gap = "20px";
        
        // 「もう一戦（リロード）」ボタン
        const retryBtn = document.createElement("button");
        retryBtn.id = "retry-btn";
        retryBtn.innerText = "もう一戦する（続行）";
        retryBtn.onclick = () => {
            location.reload(); // ページをリロードして次のゲームへ
        };
        
        // 「退出する（ホームへ）」ボタン
        const leaveBtn = document.createElement("button");
        leaveBtn.id = "leave-btn";
        leaveBtn.innerText = " 退出する（ホームへ）";
        leaveBtn.onclick = () => {
            window.location.href = '../home/home.html'; // ホーム画面へ遷移
        };
        
        choiceArea.appendChild(retryBtn);
        choiceArea.appendChild(leaveBtn);
        controlsDiv.appendChild(choiceArea);
    }
}
//ポーカーの演出に寄せた「ざわざわ」表示関数
function showZawaZawaEffect(cardCount = 1) {

    const appearanceProbability = 30; 

    // ランダムな数値（0〜99）が設定した確率以上なら、何もせずに処理を終了（非表示）にする
    if (Math.random() * 100 >= appearanceProbability) {
        return; 
    }

    const overlay = document.getElementById("zawa-zawa-overlay");
    if (!overlay) return;

    zawaSound.currentTime = 0;
    zawaSound.play().catch(e => console.log("ざわざわ再生エラー:", e));
    
    // 出した枚数に応じてフォントサイズをさらにブースト
    const sizeMultiplier = cardCount >= 4 ? 1.4 : (cardCount === 3 ? 1.2 : 1.0);
    
    const baseSizes = {
        "zawa-top-left": 4.5,
        "zawa-top-right": 7.2,
        "zawa-bottom-left": 8,
        "zawa-bottom-right": 5.2
    };

    const zawas = overlay.querySelectorAll(".zawazawa-text");
    zawas.forEach(zawa => {
        if (cardCount >= 3) {
            zawa.innerHTML = "ざわ…ざわ…<br>……ざわっ";
        } else {
            zawa.innerHTML = "ざわ…<br>……ざわ";
        }

        let finalSize = 6.5;
        if (zawa.classList.contains("zawa-top-left")) finalSize = baseSizes["zawa-top-left"] * sizeMultiplier;
        if (zawa.classList.contains("zawa-top-right")) finalSize = baseSizes["zawa-top-right"] * sizeMultiplier;
        if (zawa.classList.contains("zawa-bottom-left")) finalSize = baseSizes["zawa-bottom-left"] * sizeMultiplier;
        if (zawa.classList.contains("zawa-bottom-right")) finalSize = baseSizes["zawa-bottom-right"] * sizeMultiplier;
        
        zawa.style.fontSize = finalSize + "em";
    });

    // 一旦非表示クラスを消して、表示用のクラスを追加（これでCSSのアニメーションが走ります）
    overlay.classList.remove("zawa-zawa-hidden");
    overlay.classList.add("zawa-zawa-visible");

    //CSSのアニメーション時間（3.5秒）に合わせて非表示に戻すタイマーを設定
    const startFadeOutTime = 3500;

    if (window._zawaTimeout) clearTimeout(window._zawaTimeout);
    window._zawaTimeout = setTimeout(() => {
        overlay.classList.remove("zawa-zawa-visible");
        overlay.classList.add("zawa-zawa-hidden");
        zawaSound.pause();
    }, startFadeOutTime); 
}

if (document.getElementById('startHomeBtn')) {
    document.getElementById('startHomeBtn').addEventListener('click', () => {
        // 現在流れているベット画面のBGMやタイマーを停止
        betBgm.pause();
        if (window._msgTimeout) clearTimeout(window._msgTimeout);
        if (window._msgHideTimeout) clearTimeout(window._msgHideTimeout);
        
        // ホーム画面へ遷移
        window.location.href = '../home/home.html'; 
    });
}

const handleStartHomeClick = () => {
    // ベット画面のBGMやタイマーを停止
    betBgm.pause();
    if (window._msgTimeout) clearTimeout(window._msgTimeout);
    if (window._msgHideTimeout) clearTimeout(window._msgHideTimeout);
    
    // ホーム画面へ遷移
    window.location.href = '../home/home.html'; 
};

// 1. 初期スタート画面のホームボタンに紐付け
if (document.getElementById('startHomeBtnInitial')) {
    document.getElementById('startHomeBtnInitial').addEventListener('click', handleStartHomeClick);
}
// 2. ベットエリア内にあるホームボタンにも紐付け
if (document.getElementById('startHomeBtn')) {
    document.getElementById('startHomeBtn').addEventListener('click', handleStartHomeClick);
}

//　ゲーム開始 
initGame();
