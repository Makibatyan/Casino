// ==================== カードクラス ====================
// トランプカード1枚を表現するクラス
class Card {
    // コンストラクタ: スート、ランク、数値を設定
    constructor(suit, rank, value) {
        this.suit = suit;     // 'hearts', 'diamonds', 'clubs', 'spades'
        this.rank = rank;     // 2-14 (11=J, 12=Q, 13=K, 14=A)
        this.value = value;   // カードの強さを表す数値
    }

    // スートに対応する記号を取得 (♥♦♣♠)
    getSuitSymbol() {
        const symbols = {
            'hearts': '♥',    // ハート
            'diamonds': '♦',  // ダイヤ
            'clubs': '♣',     // クラブ
            'spades': '♠'     // スペード
        };
        return symbols[this.suit];
    }

    // ランクに対応する表示文字を取得 (A,K,Q,J,2-10)
    getRankDisplay() {
        if (this.rank === 14) return 'A';  // エース
        if (this.rank === 13) return 'K';  // キング
        if (this.rank === 12) return 'Q';  // クイーン
        if (this.rank === 11) return 'J';  // ジャック
        return this.rank.toString();       // 2-10はそのまま数字
    }
}


// 役評価モジュールはhandEvaluator.jsから読み込まれる

// ==================== ポーカーゲームクラス ====================
// テキサスホールデムゲーム全体を管理するメインクラス
class PokerGame {
    constructor() {
        // ゲームコンポーネントの初期化
        this.deck = new Deck();              // デッキ
        this.communityCards = [];           // 共有カード（5枚）
        this.playerHand = [];               // プレイヤーの手札（2枚）
        this.computerHand = [];             // コンピューターの手札（2枚）
        
        // チップとベット関連
        this.pot = 0;                       // ポット（賭け金の合計）
        this.playerChips = 1000;            // プレイヤーのチップ
        this.computerChips = 1000;          // コンピューターのチップ
        this.currentBet = 0;                // 現在のベット額
        this.playerBet = 0;                 // プレイヤーのベット額
        this.computerBet = 0;               // コンピューターのベット額
        
        // ゲームフェーズ管理
        this.gamePhase = 'waiting'; // waiting, preflop, flop, turn, river, showdown
        this.currentPlayer = 0;            // 現在のプレイヤー (0=プレイヤー, 1=コンピューター)
        this.roundStartPlayer = 0;          // ラウンド開始プレイヤー
        this.hasActedThisRound = [false, false]; // 各プレイヤーのアクション状態
        
        // UIイベントリスナーの初期化
        this.initializeEventListeners();
        this.updateUI();                    // 初期UI更新
    }

    initializeEventListeners() {           // ボタンのつながり先
        document.getElementById('newGameBtn').addEventListener('click', () => this.startNewGame());
        document.getElementById('checkBtn').addEventListener('click', () => this.playerCheck());
        document.getElementById('callBtn').addEventListener('click', () => this.playerCall());
        document.getElementById('raiseBtn').addEventListener('click', () => this.showRaiseControls());
        document.getElementById('foldBtn').addEventListener('click', () => this.playerFold());
        document.getElementById('increaseBetBtn').addEventListener('click', () => this.increaseBetAmount());
        document.getElementById('decreaseBetBtn').addEventListener('click', () => this.decreaseBetAmount());
        document.getElementById('confirmRaiseBtn').addEventListener('click', () => this.confirmRaise());
        document.getElementById('cancelRaiseBtn').addEventListener('click', () => this.cancelRaise());
    }

    /*＝＝＝＝＝＝＝＝ボタン＝＝＝＝＝＝＝＝＝＝*/ 

    startNewGame() {
        console.log("Current Phase:", this.gamePhase, "Player:", this.currentPlayer);
        
        // チップチェック
        if (this.playerChips <= 0) {
            this.updateGameStatus('チップがありません。新しいゲームを開始できません。');
            this.disableBettingButtons();
            return;
        }
        
        this.deck.reset();
        this.communityCards = [];
        this.playerHand = [];
        this.computerHand = [];
        this.pot = 0;
        this.currentBet = 10;
        this.playerBet = 0;
        this.computerBet = 0;
        this.gamePhase = 'preflop';
        this.currentPlayer = 0; // プレイヤーから開始
        this.roundStartPlayer = 0;
        this.hasActedThisRound = [false, false];
        
        // CPUレイズ表示を非表示
        document.getElementById('cpuRaiseStatus').style.display = 'none';


        
        // カード配布（2人で4枚）
        this.playerHand.push(this.deck.deal(), this.deck.deal());
        this.computerHand.push(this.deck.deal(), this.deck.deal());
        
        // 強制的に10チップアンテ（2人で20チップ）
        const playerAnte = Math.min(10, this.playerChips);
        const computerAnte = Math.min(10, this.computerChips);
        this.playerChips -= playerAnte;
        this.computerChips -= computerAnte;
        this.playerBet = playerAnte;
        this.computerBet = computerAnte;
        this.pot = playerAnte + computerAnte;
        
        this.updateUI();
        this.updateGameStatus('新しいゲームが開始されました！参加料として10チップのアンテをベットしました。');
        this.enableBettingButtons();
        
        // 新しいゲームボタンを無効化
        document.getElementById('newGameBtn').disabled = true;
    }
    playerCheck() {
        if (this.currentBet > this.playerBet) {
            this.updateGameStatus('チェックできません。コールまたはレイズしてください。');
            return;
        }
        this.updateGameStatus('プレイヤーがチェックしました。');
        this.disableBettingButtons(); // メッセージ表示中はボタンを無効化
        setTimeout(() => this.nextPlayer(), 800); // 少し遅延を入れてメッセージが見えるようにする
    }      

/*イマココ */

    playerCall() {
        const callAmount = this.currentBet - this.playerBet;   //
        // チップ不足チェックは削除（オールインを許可）
        
        if (callAmount === 0) {
            this.updateGameStatus('コールする必要はありません。チェックもしくはレイズしてください。');
            return;
        }
        
        const actualCallAmount = Math.min(callAmount, this.playerChips);
        this.playerChips = Math.max(0, this.playerChips - actualCallAmount);
        this.pot += actualCallAmount;
        this.playerBet = actualCallAmount;
        
        // オールイン時の余剰分処理
        if (actualCallAmount < callAmount) {
            const surplus = callAmount - actualCallAmount;
            this.computerChips += surplus;
            setTimeout(() => {
                this.updateGameStatus(`${actualCallAmount}チップでオールイン！余剰の${surplus}チップをCPUに返却しました。`);
            }, 800);
        } else {
            setTimeout(() => {
                this.updateGameStatus(`${callAmount}チップコールしました。`);
            }, 800);
        }
        

       this.updateUI();
    this.disableBettingButtons();  // ここで「アクションした」という事実を確定させてから判定
    setTimeout(() => {   
        // 移動した後に、ラウンドが終わったかどうかをチェック
        if (this.checkAllPlayersActed()) {
             this.checkBettingRoundComplete();
        }else {
            this.nextPlayer();
        }

    }, 800);
}

    showRaiseControls() {
        document.getElementById('betControls').style.display = 'flex';
        document.getElementById('betAmount').value = 10;
        this.disableBettingButtons();
        this.updateGameStatus('レイズ額を入力してください');
    }

    playerFold() {
        this.updateGameStatus('プレイヤーがフォールドしました。');
        this.playerBet = -1; // フォールド状態を-1で表現
        this.disableBettingButtons(); // メッセージ表示中はボタンを無効化
        setTimeout(() => this.checkBettingRoundComplete(), 800); // 少し遅延を入れてメッセージが見えるようにする
    }

    increaseBetAmount() {
        const betInput = document.getElementById('betAmount');
        const currentValue = parseInt(betInput.value) || 10;
        const newValue = Math.min(currentValue + 10, this.playerChips);
        betInput.value = newValue;
    }

    decreaseBetAmount() {
        const betInput = document.getElementById('betAmount');
        const currentValue = parseInt(betInput.value) || 10;
        const newValue = Math.max(currentValue - 10, 10);
        betInput.value = newValue;
    }

    confirmRaise() {
        console.log("Current Phase:", this.gamePhase, "Player:", this.currentPlayer);
        const raiseAmount = parseInt(document.getElementById('betAmount').value);
        if (isNaN(raiseAmount) || raiseAmount <= 0) {
            this.updateGameStatus('有効なチップ数を入力してください。');
            return;
        }
        
        // CPUがレイズした場合、CPUのレイズ額以上でなければレイズできない
        if (this.computerBet > this.playerBet && raiseAmount < (this.computerBet - this.playerBet)) {
            const minRaise = this.computerBet - this.playerBet;
            this.updateGameStatus(`CPUがレイズしています。最低${minRaise}チップ以上でレイズしてください。`);
            return;
        }
        
        const totalBet = raiseAmount;
        const needed = totalBet - this.playerBet;
        if (needed > this.playerChips) {
            this.updateGameStatus(`チップが不足しています。必要: ${needed}チップ`);
            return;
        }
        
        const actualNeeded = Math.min(needed, this.playerChips);
        this.playerChips = Math.max(0, this.playerChips - actualNeeded);
        this.pot += actualNeeded;
        this.playerBet = totalBet;
        this.currentBet = totalBet;
        
        this.player_reisuse = true;
        this.hideRaiseControls();
        this.updateUI();
        this.updateGameStatus(`${raiseAmount}チップレイズしました。`);
        
        // レイズ処理：レイズした本人以外をアクション完了を外し、レイズした本人はアクション完了にする
        this.hasActedThisRound = [false, false];
        this.hasActedThisRound[0] = true; // レイズしたプレイヤーはアクション済み
        
        this.disableBettingButtons(); // メッセージ表示中はボタンを無効化
        
        // 【重要】1秒後にターンを確認して次へ進める
        // この時点でcurrentPlayerはまだ0（プレイヤー）のまま
        // nextPlayer()を呼ぶことでcurrentPlayerが1（CPU）に切り替わる
        setTimeout(() => {
            if (this.currentPlayer === 1) {
                // currentPlayerが既に1なら何もしない（念のため）
                console.log('CPUのターンです');
            } else {
                // 通常ここに入る：nextPlayer()でターンを交代
                this.nextPlayer();
            }
        }, 1000);
    }

    cancelRaise() {
        this.hideRaiseControls();
        this.enableBettingButtons();
        this.updateGameStatus('レイズをキャンセルしました');
    }
















/*＝＝＝＝＝＝＝＝内部処理＝＝＝＝＝＝＝*/

    //レイズコントロールUIを非表示にする
    hideRaiseControls() {
        document.getElementById('betControls').style.display = 'none';
    }

    // 次のプレイヤーにターンを移す
    nextPlayer() {
        // 【ステップ1】現在のプレイヤーを「アクション済み」として記録
        // これで「誰がまだアクションしていないか」を追跡できる
        this.hasActedThisRound[this.currentPlayer] = true;
        
        // 【ステップ2】ターンを交代（0→1、1→0の切り替え）
        this.currentPlayer = 1 - this.currentPlayer;
        
        // 【ステップ3】全員がアクションしたかチェック
        // 両者ともhasActedThisRoundがtrueなら、ベッティングラウンド完了
        if (this.checkAllPlayersActed()) {
            this.checkBettingRoundComplete(); // 次のフェーズへ進む
        }
        // 【ステップ4】まだ続く場合は次のプレイヤーのターンを開始
        else if (this.currentPlayer === 0) {
            // プレイヤーのターン：ボタンを有効化して操作待ち
            this.enableBettingButtons();
        } else {
            // CPUのターン：0.8秒後にcomputerAction()を実行
            console.log('CPUのターンを開始します');
            setTimeout(() => this.computerAction(), 800);
        }
    }

    // プレイヤーがアクティブかチェック（フォールドしていない）
    isPlayerActive(playerIndex) {
        if (playerIndex === 0) return this.playerBet >= 0; // -1がフォールド
        if (playerIndex === 1) return this.computerBet >= 0; // -1がフォールド
        return false;
    }

    // 全員がアクション完了したかチェック
    checkAllPlayersActed() {
        console.log("Current Phase:", this.gamePhase, "Player:", this.currentPlayer);
        
        // 【アクティブプレイヤーの判定】
        // playerBet >= 0 → フォールドしていない（アクティブ）
        // playerBet = -1 → フォールド済み（非アクティブ）
        const activePlayers = [];
        
        // プレイヤーがフォールドしていない場合
        if (this.playerBet >= 0) {
            activePlayers.push(0);
        }
        // コンピューターがフォールドしていない場合
        if (this.computerBet >= 0) {
            activePlayers.push(1);
        }
        
        // 【片方がフォールドした場合】
        // アクティブプレイヤーが1人だけなら、ベッティングラウンドは即座に完了
        if (activePlayers.length === 1) {
            return true;
        }
        
        // 【両者ともアクティブな場合】
        // hasActedThisRound[0]とhasActedThisRound[1]が両方trueなら完了
        // レイズが発生すると両方falseにリセットされる（相手に応答を求めるため）
        return activePlayers.every(index => this.hasActedThisRound[index]);
    }

    // ベッティングラウンドが完了したかチェック
    checkBettingRoundComplete() {
        const activePlayers = [];
        
        // プレイヤーがフォールドしていない場合
        if (this.playerBet >= 0) {
            activePlayers.push(0);
        }
        // コンピューターがフォールドしていない場合
        if (this.computerBet >= 0) {
            activePlayers.push(1);
        }
        
        if (activePlayers.length === 1) {
            // 1人だけ残った場合、ショーダウンへ
            this.gamePhase = 'showdown';
            this.showdown();
            return;
        }
        
        // オールインチェック
        const allInPlayers = [];
        // プレイヤーがオールインの場合
        if (this.playerChips === 0 && this.playerBet > 0) {
            allInPlayers.push(0);
        }
        // コンピューターがオールインの場合
        if (this.computerChips === 0 && this.computerBet > 0) {
            allInPlayers.push(1);
        }
        
        // 片方がオールインでもう片方がコールした場合、即座にショーダウン
        if (allInPlayers.length === 1 && activePlayers.length === 2) {
            // 残りのカードをすべて配る
            while (this.communityCards.length < 5) {
                this.communityCards.push(this.deck.deal());
            }
            this.gamePhase = 'showdown';
            this.updateGameStatus('オールイン！すべてのカードをオープンします。');
            setTimeout(() => this.showdown(), 800);
            return;
        }
        
        // アクティブなプレイヤー全員がベット揃いしているかチェック
        let allBetsMatch = true;
        for (const playerIndex of activePlayers) {
            const bet = playerIndex === 0 ? this.playerBet : this.computerBet;
            if (bet !== this.currentBet) {
                allBetsMatch = false;
                break;
            }
        }
        
        // 全員が同じベット額で、かつ全員がアクション完了している場合
        if (allBetsMatch && this.checkAllPlayersActed()) {
            this.nextPhase(); // 即座に次のフェーズへ
        }
    }

    computerAction() {
        console.log('computerActionが呼ばれました');
        
        // 【CPUの情報取得】
        const hand = this.computerHand;
        const playerChips = this.computerChips;
        const currentBet = this.computerBet;
        const playerName = 'コンピューター';
        
        // 【ハンド評価と確率計算】
        // handEvaluator.jsでハンドの強さを判定（0:ハイカード ～ 4:ストレートフラッシュ）
        const computerHand = HandEvaluator.evaluateHand([...hand, ...this.communityCards]);
        const random = Math.random(); // 0.0～1.0の乱数（行動のバリエーション用）
        
        // 【コールに必要な額を計算】
        // this.currentBet = 場の最高額, currentBet = CPUが既にベットした額
        const callAmount = this.currentBet - currentBet;
        
        // 【ポットオッズ計算】
        // コール額 ÷ (ポット + コール額) = 勝率がこれ以上ならコールすべき
        const potOdds = callAmount > 0 ? callAmount / (this.pot + callAmount) : 0;
        
        // 【相手のレイズサイズ分析】
        // ポットに対するレイズ額の比率で、相手の強気度を判断
        const raiseSize = this.currentBet;
        const raiseToPotRatio = raiseSize / this.pot; // 例：ポット100に対してレイズ50なら0.5
        
        // 【ヘルパー関数】チップとベット額を更新
        const updateChipsAndBet = (amount, newBet) => {
            this.computerChips = Math.max(0, this.computerChips - amount);
            this.computerBet = newBet;
        };
        
        const setBetToZero = () => {
            this.computerBet = -1;
        };
        
        // 【分岐1】相手がレイズした場合（this.currentBet > CPUのcurrentBet）
        // → フォールド、コール、再レイズの選択肢
        if (this.player_reisuse == true) {
            this.player_reisuse = false;

            // 【フォールド確率の計算】
            // ハンドが強いほどフォールド確率が低い（強気に行く）
            // rank 0(ハイカード):15%  1(ワンペア):8%  2(ツーペア):4%  3(スリーカード):2%  4以上:1%
            let foldProbability = [0.15, 0.08, 0.04, 0.02, 0.01][Math.min(computerHand.rank, 4)];
            
            // 【相手のレイズサイズを考慮】
            // 大きなレイズには大きなハンドが必要と判断
            if (raiseToPotRatio > 1.0) foldProbability += 0.1;  // ポット以上のレイズは危険、+10%
            else if (raiseToPotRatio > 0.5) foldProbability += 0.05; // 半分以上なら+5%
            
            // 【ポットオッズを考慮】
            // ポットオッズが悪い（コールに対して得られる利益が少ない）場合、フォールドしやすくする
            if (potOdds > 0.3) foldProbability += 0.05; // 30%以上必要なら+5%
            if (potOdds > 0.5) foldProbability += 0.1;  // 50%以上必要なら+10%
            
            if (random < Math.min(foldProbability, 0.4)) {
                this.updateGameStatus(`${playerName}がフォールドしました。`);
                setBetToZero();
                setTimeout(() => this.checkBettingRoundComplete(), 800); // フォールド時は長めの遅延
            } else {
                updateChipsAndBet(callAmount, this.currentBet);
                this.pot += callAmount;
                this.updateGameStatus(`${playerName}が${callAmount}チップコールしました。`);
                this.updateUI(); // UIを更新してメッセージを確実に表示
                this.disableBettingButtons(); // 遅延中はボタンを無効化
                setTimeout(() => {
                    if (this.checkAllPlayersActed()) {
                    this.checkBettingRoundComplete();
                }else {
            this.nextPlayer();
        }
                }, 800); // 少し遅延を入れてメッセージが見えるようにする
            }
        } else {
            // 【レイズ確率の計算】
            // ハンドが強いほどレイズ確率が高い（攻撃的に行く）
            // rank 0:10%  1:15%  2:30%  3:40%  4以上:50%
            let raiseProbability = [0.1, 0.15, 0.3, 0.4, 0.5][Math.min(computerHand.rank, 4)];
            
            // 15%の確率で「ブラフレイズ」のチャンスを追加（弱いハンドでも強気に出る）
            if (random < 0.15) raiseProbability += 0.25;
            
            // 【レイズ実行条件】乱数 < 確率 かつ チップが50以上
            if (random < Math.min(raiseProbability, 0.5) && playerChips > 50) {
                const raiseAmount = Math.min(50 + Math.floor(random * 50), playerChips);
                updateChipsAndBet(raiseAmount, currentBet + raiseAmount);
                this.pot += raiseAmount;
                this.currentBet = currentBet + raiseAmount;
                this.updateGameStatus(`${playerName}が${raiseAmount}チップレイズしました。`);
                
                // レイズ処理：レイズした本人以外をアクション完了を外し、レイズした本人はアクション完了にする
                this.hasActedThisRound = [false, false];
                this.hasActedThisRound[1] = true; // レイズしたCPUはアクション済み
                
                // CPUレイズ額を表示
                document.getElementById('cpuRaiseStatus').style.display = 'block';
                document.getElementById('cpuRaiseAmount').textContent = raiseAmount;
                
                this.disableBettingButtons(); // 遅延中はボタンを無効化
                setTimeout(() => {
                    if (this.currentPlayer === 0) {
                        this.enableBettingButtons();
                    }else {
                        this.nextPlayer();
                    }
                }, 800); // 少し遅延を入れてメッセージが見えるようにする
            } else {
                // 【チェック処理】レイズせずにターンを終了
                // ※このelseブロックは「this.currentBet > currentBet」がfalseの時=相手がチェックした時のみ実行
                this.updateGameStatus(`${playerName}がチェックしました。`);
                this.updateUI(); // UIを更新してメッセージを確実に表示
                this.disableBettingButtons(); // 遅延中はボタンを無効化
                
                setTimeout(() => {
                    // ラウンドが終わったかどうかをチェック
                    if (this.checkAllPlayersActed()) {
                        this.checkBettingRoundComplete(); // 次のフェーズへ
                    } else {
                        this.nextPlayer(); // プレイヤーに交代
                    }
                }, 800);
            }
        }
    }

    nextPhase() {
        // フェーズ移行中はボタンを無効化
        this.disableBettingButtons();
        
        // CPUレイズ表示を非表示
        document.getElementById('cpuRaiseStatus').style.display = 'none';
        
        // ベットをリセット
        this.playerBet = 0;
        this.computerBet = 0;
        this.currentBet = 0;
        this.currentPlayer = 0; // プレイヤーから開始
        this.hasActedThisRound = [false, false]; // アクション状態をリセット
        
    
        switch (this.gamePhase) {
            case 'preflop':
                this.communityCards.push(this.deck.deal(), this.deck.deal(), this.deck.deal());
                this.gamePhase = 'flop';
                this.updateGameStatus('フロップ！');
                this.disableBettingButtons();
                break;
            case 'flop':
                this.communityCards.push(this.deck.deal());
                this.gamePhase = 'turn';
                this.updateGameStatus('ターン！');
                this.disableBettingButtons();
                break;
            case 'turn':
                this.communityCards.push(this.deck.deal());
                this.gamePhase = 'river';
                this.updateGameStatus('リバー！');
                this.disableBettingButtons();
                break;
            case 'river':
                this.showdown();
                return;
        }
        
        this.updateUI();
        
        // 少し遅延してから次のベッティングラウンドを開始
        setTimeout(() => {
            if (this.currentPlayer === 0) {
                this.enableBettingButtons();
            }
            // CPUのターンはnextPlayer関数で処理するため、ここでは呼ばない
        }, 800); // 600ms遅延してフェーズ移行の演出を確実に表示
    }

    showdown() {
        this.gamePhase = 'showdown';
        
        // 全員のハンドを評価
        const hands = [
            { player: 0, hand: HandEvaluator.evaluateHand([...this.playerHand, ...this.communityCards]), name: 'プレイヤー' },
            { player: 1, hand: HandEvaluator.evaluateHand([...this.computerHand, ...this.communityCards]), name: 'コンピューター' }
        ];
        
        // フォールドしたプレイヤーを除外
        const bets = [this.playerBet, this.computerBet];
        const activeHands = hands.filter((h, i) => bets[i] >= 0); // -1がフォールド
        
        // 最強のハンドを見つける
        activeHands.sort((a, b) => HandEvaluator.compareHands(b.hand, a.hand));
        
        // ハンドの比較結果を表示
        let comparisonMessage = `ショーダウン！\n`;
        
        // アクティブなプレイヤーのハンドのみ表示
        if (this.playerBet >= 0) {
            const playerHand = hands[0];
            document.getElementById('playerHandRank').textContent = playerHand.hand.rankName;
            comparisonMessage += `プレイヤー: ${playerHand.hand.rankName}\n`;
        } else {
            document.getElementById('playerHandRank').textContent = 'フォールド';
            comparisonMessage += `プレイヤー: フォールド\n`;
        }
        
        if (this.computerBet >= 0) {
            const computerHand = hands[1];
            document.getElementById('computerHandRank').textContent = computerHand.hand.rankName;
            comparisonMessage += `コンピューター: ${computerHand.hand.rankName}\n`;
        } else {
            document.getElementById('computerHandRank').textContent = 'フォールド';
            comparisonMessage += `コンピューター: フォールド\n`;
        }
        
        // 勝者を判定
        const winner = activeHands[0]; // 最強のハンド（ソート済み）
        
        // 引き分けかどうかを確認
        const winners = activeHands.filter(h => 
            HandEvaluator.compareHands(h.hand, winner.hand) === 0
        );
        
        if (winners.length === 1) {
                this.endRound(winner.player);
        } else {
            // 引き分けの場合
            const shareAmount = Math.floor(this.pot / winners.length);
            
            comparisonMessage = `\n引き分け！${shareAmount}チップずつ獲得！`;
            this.updateGameStatus(comparisonMessage);
            
            winners.forEach(w => {
                if (w.player === 0) this.playerChips += shareAmount;
                else if (w.player === 1) this.computerChips += shareAmount;
            });
            
            // 引き分けの場合は両方をハイライト
            document.querySelectorAll('.player-area').forEach(area => {
                area.style.background = 'linear-gradient(135deg, rgba(255, 193, 7, 0.3), rgba(255, 235, 59, 0.3))';
                area.style.border = '2px solid #ffc107';
                area.style.boxShadow = '0 0 20px rgba(255, 193, 7, 0.5)';
            });
            
            this.updateUI();
            this.disableBettingButtons();
            
            // 5秒後にゲーム終了メッセージを表示
            setTimeout(() => {
                this.updateGameStatus('ゲーム終了。新しいゲームを開始するにはページを更新してください。');
                // ハイライトをリセット
                document.querySelectorAll('.player-area').forEach(area => {
                    area.style.background = '';
                    area.style.border = '';
                    area.style.boxShadow = '';
                });
            }, 800);
            
            // ゲーム終了状態を確実に設定
            this.gamePhase = 'ended';
            
            
        }
    }



    //ボタンの無効化
    enableBettingButtons() {
        console.log("Current Phase:", this.gamePhase, "Player:", this.currentPlayer);
        // ゲームが終了している場合はボタンを有効化しない
        if (this.gamePhase === 'ended') {
            return;
        }
        
        document.getElementById('checkBtn').disabled = false;
        document.getElementById('callBtn').disabled = false;
        document.getElementById('raiseBtn').disabled = false;
        document.getElementById('foldBtn').disabled = false;
        this.hideRaiseControls();
    }
    //ボタンの有効化
    disableBettingButtons() {
        console.log("Current Phase:", this.gamePhase, "Player:", this.currentPlayer);
        document.getElementById('checkBtn').disabled = true;
        document.getElementById('callBtn').disabled = true;
        document.getElementById('raiseBtn').disabled = true;
        document.getElementById('foldBtn').disabled = true;
    }

    updateGameStatus(message) {
        document.getElementById('gameStatus').textContent = message;
    }

    createCardElement(card, isHidden = false) {
        const cardDiv = document.createElement('div');
        
        if (!isHidden) {
            // スート記号をCSSクラス名に変換
            let suitClass = '';
            switch(card.suit) {
                case '♥': suitClass = 'hearts'; break;
                case '♦': suitClass = 'diamonds'; break;
                case '♣': suitClass = 'clubs'; break;
                case '♠': suitClass = 'spades'; break;
                default: suitClass = '';
            }
            cardDiv.className = `card ${suitClass}`;
            
            cardDiv.innerHTML = `
                <div class="suit">${card.suit}</div>
                <div class="rank">${card.rank}</div>
            `;
        } else {
            cardDiv.className = 'card back';
            cardDiv.innerHTML = '?';
        }
        
        return cardDiv;
    }


    // ラウンドを終了して勝者にポットを分配
    endRound(winner) {
        this.gamePhase = 'waiting';
        
        // ポットを勝者に分配
        if (winner === 0) {
            this.playerChips += this.pot;
            this.updateGameStatus('🎉 プレイヤーの勝利！🎉 ' + this.pot + 'チップのポットを獲得しました！');
            // プレイヤー領域をハイライト
            document.querySelector('.player-area:first-child').style.background = 'linear-gradient(135deg, rgba(76, 175, 80, 0.3), rgba(139, 195, 74, 0.3))';
            document.querySelector('.player-area:first-child').style.border = '2px solid #4caf50';
            document.querySelector('.player-area:first-child').style.boxShadow = '0 0 20px rgba(76, 175, 80, 0.5)';
        } else {
            this.computerChips += this.pot;
            this.updateGameStatus('💻 コンピューターの勝利！💻 ' + this.pot + 'チップのポットを獲得しました！');
            // CPU領域をハイライト
            document.querySelector('.player-area:last-child').style.background = 'linear-gradient(135deg, rgba(244, 67, 54, 0.3), rgba(239, 83, 80, 0.3))';
            document.querySelector('.player-area:last-child').style.border = '2px solid #f44336';
            document.querySelector('.player-area:last-child').style.boxShadow = '0 0 20px rgba(244, 67, 54, 0.5)';
        }
        
        this.updateUI();
        this.disableBettingButtons();
        
        // 5秒後にゲーム終了メッセージを表示
        setTimeout(() => {
            this.updateGameStatus('ゲーム終了。新しいゲームを開始するにはページを更新してください。');
            // 新しいゲームボタンを再有効化
            document.getElementById('newGameBtn').disabled = false;
            // ハイライトをリセット
            document.querySelectorAll('.player-area').forEach(area => {
                area.style.background = '';
                area.style.border = '';
                area.style.boxShadow = '';
            });
        }, 3000);
    
        // ゲーム終了状態を確実に設定
        this.gamePhase = 'ended';
        


    }

    updateUI() {
        console.log("Current Phase:", this.gamePhase, "Player:", this.currentPlayer);
        // 基本情報更新
        document.getElementById('potAmount').textContent = this.pot;
        document.getElementById('playerChips').textContent = this.playerChips;
        document.getElementById('computerChips').textContent = this.computerChips;
        
                
        // 現在のベット状態を更新
        const betStatusDiv = document.getElementById('betStatus');
        const currentBetDisplay = document.getElementById('currentBetDisplay');
        
        if (this.gamePhase === 'waiting') {
            betStatusDiv.innerHTML = 'ゲーム待機中';
        } else if (this.currentBet === 0) {
            betStatusDiv.innerHTML = 'チェック状態';
        } else {
            betStatusDiv.innerHTML = `現在のベット: <span>${this.currentBet}</span> チップ`;
        }
        
        // コミュニティカード
        const communityDiv = document.getElementById('communityCards');
        communityDiv.innerHTML = '';
        this.communityCards.forEach(card => communityDiv.appendChild(this.createCardElement(card)));
        
        // プレイヤーカード
        const playerDiv = document.getElementById('playerCards');
        playerDiv.innerHTML = '';
        this.playerHand.forEach(card => playerDiv.appendChild(this.createCardElement(card)));
        
        // コンピューターカード
        const computerDiv = document.getElementById('computerCards');
        computerDiv.innerHTML = '';
        const isHidden = this.gamePhase !== 'showdown' && this.gamePhase !== 'waiting';
        this.computerHand.forEach(card => computerDiv.appendChild(this.createCardElement(card, isHidden)));
        
        // ハンドランク表示
        if (this.gamePhase === 'showdown' && this.playerHand.length > 0) {
            const hands = [
                { id: 'playerHandRank', hand: this.playerHand },
                { id: 'computerHandRank', hand: this.computerHand }
            ];
            
            hands.forEach(({ id, hand }) => {
                const div = document.getElementById(id);
                if (div) {
                    const bestHand = HandEvaluator.evaluateHand([...hand, ...this.communityCards]);
                    div.textContent = bestHand.name;
                }
            });
        } else {
            // ハンドランクをクリア
            ['playerHandRank', 'computerHandRank'].forEach(id => {
                const div = document.getElementById(id);
                if (div) div.textContent = '';
            });
        }
    }
}

const game = new PokerGame();
