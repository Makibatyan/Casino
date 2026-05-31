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
    skipNext: null
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
    
    if (isClickable && !gameState.isGameOver) {
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
        statusEl.innerText = "🔥 11バック中！";
        statusEl.style.color = "#42a5f5";
    } else if (gameState.isRevolution) {
        statusEl.innerText = "🔥 革命中！強さ関係が逆転しています！";
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
    if (gameState.isGameOver) return;
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
    const selectedCards = gameState.selectedCards;
    const hasJoker = selectedCards.some(i => isJoker(gameState.playerHand[i]));
    const nonJokerCards = selectedCards.filter(i => !isJoker(gameState.playerHand[i]));
    const nonJokerRanks = [...new Set(nonJokerCards.map(i => gameState.playerHand[i].rank))];
    
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

//　ゲームロジック
function initGame() {
    gameState.deck = shuffleDeck(createDeck());
    gameState.playerHand = sortHand(gameState.deck.slice(0, 14));
    gameState.cpuHand = sortHand(gameState.deck.slice(14, 28));
    gameState.lastPlayed = { rank: 0, count: 0 };
    gameState.selectedCards = [];
    gameState.isRevolution = false;
    gameState.isGameOver = false;
    gameState.skipNext = null;
    document.getElementById("play-btn").disabled = false;
    document.getElementById("pass-btn").disabled = false;
    const msgEl = document.getElementById("msg");
    msgEl.classList.remove("visible", "result");
    msgEl.innerText = "";
    
    updateRevolutionStatus();
    renderHand();
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
    
    // 革命チェック
    if (cards.length >= 4) {
        gameState.isRevolution = !gameState.isRevolution;
        updateRevolutionStatus();
        const revolutionMsg = gameState.isRevolution ? 
            "革命！強さ関係が逆転しました！" : 
            "革命が終わり、通常の強さ関係に戻りました！";
        showMessage(revolutionMsg);
    }
    
    // 8切りチェック
    if (mainCard.rank === 8) {
        showMessage("8切り！場が流れました。" + (isPlayer ? "あなたの番です。" : "CPUの番です。"));
        gameState.lastPlayed = { rank: 0, count: 0 };
        document.getElementById("field-cards").innerHTML = "流されました";
        resetTemporaryRevolution();
        return true; // 8切り発生
    }

    // 11バックチェック
    if (mainCard.rank === 11) {
        gameState.isElevenBack = true;
        updateRevolutionStatus();
        showMessage("11バック！場が流れている間、強さが逆転します。");
    }

    // 5スキップチェック
    if (mainCard.rank === 5) {
        // 次の相手ターンをスキップする
        gameState.skipNext = isPlayer ? 'cpu' : 'player';
        // 場はリセットしない（そのまま維持する）
        if (isPlayer) {
            showMessage("5が出されました！CPUのターンをスキップします。あなたの番です。");
        } else {
            showMessage("CPUが5を出しました！あなたのターンをスキップします。CPUの番です。");
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
    gameState.lastPlayed = { rank: mainCard.rank, count: cards.length };
    updateField(cards);
    
    const isEightCut = handleSpecialCards(cards, isPlayer);
    
    // 手札から削除
    if (isPlayer) {
        gameState.playerHand = gameState.playerHand.filter((_, i) => !gameState.selectedCards.includes(i));
        gameState.selectedCards = [];
        renderHand();
        checkWin("Player");
        
        if (gameState.isGameOver) return;

        if (!isEightCut) {
            if (gameState.skipNext === 'cpu') {
                // CPUのターンをスキップ：フィールドは既にリセット済み
                gameState.skipNext = null;
                // プレイヤーのターン継続のため、再描画のみ
                renderHand();
            } else {
                setTimeout(cpuTurn, 1000);
            }
        }
    } else {
        gameState.cpuHand = gameState.cpuHand.filter(c => !cards.includes(c));
        if (isEightCut) {
            setTimeout(cpuTurn, 1500);
        }
        renderHand();
        checkWin("CPU");

        if (gameState.isGameOver) return;

        if (!isEightCut) {
            if (gameState.skipNext === 'player') {
                // プレイヤーのターンをスキップ：CPUは2秒後に自動で再行動
                gameState.skipNext = null;
                showMessage("CPUが5を出しました：あなたのターンはスキップされます。");
                setTimeout(cpuTurn, 2000);
            }
        }
    }
}

//プレイヤー操作
document.getElementById("play-btn").onclick = () => {
    if (gameState.isGameOver || gameState.selectedCards.length === 0) return;
    
    const cardsToPlay = gameState.selectedCards.map(i => gameState.playerHand[i]);

    if (canPlayCards(cardsToPlay)) {
        playCards(cardsToPlay, true);
    } else {
        showMessage("そのカードは出せません");
    }
};

document.getElementById("pass-btn").onclick = () => {
    if (gameState.isGameOver) return;
    resetTemporaryRevolution();
    gameState.lastPlayed = { rank: 0, count: 0 };
    document.getElementById("field-cards").innerHTML = "流されました";
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
        showMessage("CPUがパスしました。あなたの番です。");
        renderHand();
        checkWin("CPU");
    }
}

//　ゲーム終了チェック
function checkWin(playerName) {
    if (gameState.playerHand.length === 0) {
        setGameOver();
        showResult("🎉 あなたの勝ちです！");
    }
    if (gameState.cpuHand.length === 0) {
        setGameOver();
        showResult("💻 CPUの勝ちです！");
    }
}

//　ゲーム開始 
initGame();