// ==================== 役評価モジュール ====================
// ポーカーの役を評価するためのユーティリティ関数

// 役のランク（数字が大きいほど強い）
const HAND_RANKS = {
    HIGH_CARD: 1,      // ハイカード
    ONE_PAIR: 2,       // ワンペア
    TWO_PAIR: 3,       // ツーペア
    THREE_OF_A_KIND: 4, // スリーオブアカインド
    STRAIGHT: 5,       // ストレート
    FLUSH: 6,          // フラッシュ
    FULL_HOUSE: 7,     // フルハウス
    FOUR_OF_A_KIND: 8,  // フォーオブアカインド
    STRAIGHT_FLUSH: 9, // ストレートフラッシュ
    ROYAL_FLUSH: 10    // ロイヤルフラッシュ
};

// 役の日本語名
const HAND_NAMES = {
    1: 'ハイカード',
    2: 'ワンペア',
    3: 'ツーペア',
    4: 'スリーオブアカインド',
    5: 'ストレート',
    6: 'フラッシュ',
    7: 'フルハウス',
    8: 'フォーオブアカインド',
    9: 'ストレートフラッシュ',
    10: 'ロイヤルフラッシュ'
};

// デッキクラス
class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

        for (let suit of suits) {
            for (let i = 0; i < ranks.length; i++) {
                this.cards.push({
                    suit: suit,
                    rank: ranks[i],
                    value: values[i]
                });
            }
        }
        this.shuffle();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal() {
        return this.cards.pop();
    }
}

// ハンド評価クラス
class HandEvaluator {
    // 7枚のカードから最強の5カードハンドを評価
    static evaluateHand(cards) {
        if (cards.length < 5) {
            return { rank: 0, name: '不明', cards: [] };
        }

        // 5枚の組み合わせを全て試して最強の手を見つける
        const bestHand = this.findBestHand(cards);
        return bestHand;
    }

    // 7枚から5枚の組み合わせで最強の手を見つける
    static findBestHand(cards) {
        const combinations = this.getCombinations(cards, 5);
        let bestHand = null;

        for (let combination of combinations) {
            const hand = this.evaluateFiveCards(combination);
            if (!bestHand || this.compareHands(hand, bestHand) > 0) {
                bestHand = hand;
            }
        }

        return bestHand;
    }

    // 5枚カードの組み合わせを取得
    static getCombinations(arr, k) {
        const combinations = [];
        
        function backtrack(start, current) {
            if (current.length === k) {
                combinations.push([...current]);
                return;
            }
            
            for (let i = start; i < arr.length; i++) {
                current.push(arr[i]);
                backtrack(i + 1, current);
                current.pop();
            }
        }
        
        backtrack(0, []);
        return combinations;
    }

    // 5枚カードのハンドを評価
    static evaluateFiveCards(cards) {
        const sortedCards = [...cards].sort((a, b) => b.value - a.value);
        
        // フラッシュチェック
        const isFlush = this.checkFlush(sortedCards);
        
        // ストレートチェック
        const isStraight = this.checkStraight(sortedCards);
        
        // カードのカウント
        const counts = this.countCards(sortedCards);
        const pairs = this.findPairs(counts);
        const threeOfKind = this.findThreeOfKind(counts);
        const fourOfKind = this.findFourOfKind(counts);

        // 役の判定
        if (isStraight && isFlush) {
            if (sortedCards[0].value === 14 && sortedCards[4].value === 10) {
                return { rank: HAND_RANKS.ROYAL_FLUSH, name: HAND_NAMES[10], cards: sortedCards };
            }
            return { rank: HAND_RANKS.STRAIGHT_FLUSH, name: HAND_NAMES[9], cards: sortedCards };
        }

        if (fourOfKind) {
            return { rank: HAND_RANKS.FOUR_OF_A_KIND, name: HAND_NAMES[8], cards: sortedCards };
        }

        if (threeOfKind && pairs.length >= 1) {
            return { rank: HAND_RANKS.FULL_HOUSE, name: HAND_NAMES[7], cards: sortedCards };
        }

        if (isFlush) {
            return { rank: HAND_RANKS.FLUSH, name: HAND_NAMES[6], cards: sortedCards };
        }

        if (isStraight) {
            return { rank: HAND_RANKS.STRAIGHT, name: HAND_NAMES[5], cards: sortedCards };
        }

        if (threeOfKind) {
            return { rank: HAND_RANKS.THREE_OF_A_KIND, name: HAND_NAMES[4], cards: sortedCards };
        }

        if (pairs.length >= 2) {
            return { rank: HAND_RANKS.TWO_PAIR, name: HAND_NAMES[3], cards: sortedCards };
        }

        if (pairs.length === 1) {
            return { rank: HAND_RANKS.ONE_PAIR, name: HAND_NAMES[2], cards: sortedCards };
        }

        return { rank: HAND_RANKS.HIGH_CARD, name: HAND_NAMES[1], cards: sortedCards };
    }

    // フラッシュチェック
    static checkFlush(cards) {
        const suit = cards[0].suit;
        return cards.every(card => card.suit === suit);
    }

    // ストレートチェック
    static checkStraight(cards) {
        for (let i = 0; i < cards.length - 1; i++) {
            if (cards[i].value - cards[i + 1].value !== 1) {
                // A-2-3-4-5の特殊ケース
                if (i === 0 && cards[0].value === 14 && 
                    cards[1].value === 5 && cards[2].value === 4 && 
                    cards[3].value === 3 && cards[4].value === 2) {
                    return true;
                }
                return false;
            }
        }
        return true;
    }

    // カードのカウント
    static countCards(cards) {
        const counts = {};
        for (let card of cards) {
            counts[card.value] = (counts[card.value] || 0) + 1;
        }
        return counts;
    }

    // ペアを探す
    static findPairs(counts) {
        const pairs = [];
        for (let value in counts) {
            if (counts[value] === 2) {
                pairs.push(parseInt(value));
            }
        }
        return pairs.sort((a, b) => b - a);
    }

    // スリーオブアカインドを探す
    static findThreeOfKind(counts) {
        for (let value in counts) {
            if (counts[value] === 3) {
                return parseInt(value);
            }
        }
        return null;
    }

    // フォーオブアカインドを探す
    static findFourOfKind(counts) {
        for (let value in counts) {
            if (counts[value] === 4) {
                return parseInt(value);
            }
        }
        return null;
    }

    // 2つのハンドを比較
    static compareHands(hand1, hand2) {
        if (hand1.rank !== hand2.rank) {
            return hand1.rank - hand2.rank;
        }
        
        // 同じ役の場合、カードの強さで比較
        for (let i = 0; i < Math.min(hand1.cards.length, hand2.cards.length); i++) {
            if (hand1.cards[i].value !== hand2.cards[i].value) {
                return hand1.cards[i].value - hand2.cards[i].value;
            }
        }
        
        return 0; // 完全に同じハンド
    }
}

// グローバル変数としてエクスポート
window.Deck = Deck;
window.HandEvaluator = HandEvaluator;
window.HAND_RANKS = HAND_RANKS;
window.HAND_NAMES = HAND_NAMES;
