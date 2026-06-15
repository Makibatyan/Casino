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

        this.lastCommunityCardsCount = 0;
        this.lastGamePhase = "";
        
        // 万とベット関連
        this.pot = 0;                       // ポット（賭け金の合計）
        this.playerChips = parseInt(localStorage.getItem('bugging_cash')) || 10000000;             // プレイヤーの万（初期1000万ペリカ）
        this.computerChips = 1000000000000000;   // コンピューターの万
        this.currentBet = 0;                // 現在のベット額
        this.playerBet = 0;                 // プレイヤーのベット額
        this.computerBet = 0;               // コンピューターのベット額
        
        // ゲームフェーズ管理
        this.gamePhase = 'waiting'; // waiting, preflop, flop, turn, river, showdown, ended
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
        
        // 参加料（1000万ペリカ）に足りるかチェック
        if (this.playerChips < 10000000) {
            this.updateGameStatus('ペリカ不足しています（最低1000万ペリカ必要）。新しいゲームを開始できません。');
            this.disableBettingButtons();
            return;
        }
        if (this.playerChips < 10000000) {
            this.updateGameStatus('ペリカ不足しています（最低1000万ペリカ必要）。ホームに戻ります…');
            this.disableBettingButtons();
            
            // 2秒後にホームへ自動移動
            setTimeout(() => {
                window.location.href = '../home.html';
            }, 2000);
            return;
        }

        this.deck.reset();
        this.communityCards = [];
        this.playerHand = [];
        this.computerHand = [];
        this.pot = 0;
        this.currentBet = 10000000; // 初期ベット額を1000万に変更
        this.playerBet = 0;
        this.computerBet = 0;
        this.gamePhase = 'preflop';
        this.currentPlayer = 0; // プレイヤーから開始
        this.roundStartPlayer = 0;
        this.hasActedThisRound = [false, false];
        document.body.classList.remove('all-in-active');

        //次のゲームが始まったら通常BGMに戻し、ざわBGMのボリュームを下げる
        const zawaBgm = document.getElementById('zawazawaBgm');
        if (zawaBgm) {
            zawaBgm.pause();
            zawaBgm.currentTime = 0; // 再生位置を最初に戻しておく
        }
        VolumeManager.applyBgm(); // 音量を通常状態へ復元

        // CPUレイズ表示を非表示
        document.getElementById('cpuRaiseStatus').style.display = 'none';

        // カード配布（2人で4枚）
        this.playerHand.push(this.deck.deal(), this.deck.deal());
        this.computerHand.push(this.deck.deal(), this.deck.deal());
        
        // 強制的に100万アンテ（2人で2000万）
        const playerAnte = Math.min(10000000, this.playerChips);
        const computerAnte = Math.min(10000000, this.computerChips);
        this.playerChips -= playerAnte;
        this.computerChips -= computerAnte;
        this.playerBet = playerAnte;
        this.computerBet = computerAnte;
        this.pot = playerAnte + computerAnte;
        
        this.updateUI();
        this.updateGameStatus('新しいゲームが開始されました！参加料として1000万ペリカのアンテをベットしました。');
        this.enableBettingButtons();

        console.log("Current Phase:", this.gamePhase, "Player:", this.currentPlayer);
        
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
        if(this.playerChips === 0){
         setTimeout(() => {
                document.body.classList.add('all-in-active');
                setTimeout(() => {
                this.hasActedThisRound[1] = true; 
                this.nextPlayer()
                },800);
         }, 2000);
        }else{
        setTimeout(() => this.nextPlayer(), 800); // 少し遅延を入れてメッセージが見えるようにする
        } 
    }     

    playerCall() {
        // コールに必要な「追加の」額を計算
        const callAmount = this.currentBet - this.playerBet;
        
        if (callAmount <= 0) {
            this.updateGameStatus('コールする必要はありません。チェックもしくはレイズしてください。');
            return;
        }
        
        // 実際に支払える額（手持ち万が足りない場合はオールイン）
        const actualCallAmount = Math.min(callAmount, this.playerChips);
        
        // 万の減算とポットへの追加
        this.playerChips = Math.max(0, this.playerChips - actualCallAmount);
        this.checkAllInStatus();
        this.pot += actualCallAmount;
        
        this.playerBet += actualCallAmount;
        
        // オールイン時の余剰分処理
        if (actualCallAmount < callAmount) {
            const surplus = callAmount - actualCallAmount; 
            
            // 1. CPUの手持ちに返す
            this.computerChips += surplus;
            
            // 2. ポットからもその余剰分を引く
            this.pot -= surplus; 
            
            // 3. お互いのベット額の「着地点」を、プレイヤーが全賭けした額に合わせる
            this.computerBet = this.playerBet; 
            this.currentBet = this.playerBet;  
            
            if (this.playerChips === 0) {
                // プレイヤーのチップが0 ＝ オールイン！
                document.body.classList.add('all-in-active');
                this.checkAllInStatus();
            }

            setTimeout(() => {
                document.body.classList.add('all-in-active');
                this.updateGameStatus(`${actualCallAmount.toLocaleString()}ペリカでオールイン！余剰の${surplus.toLocaleString()}ペリカをCPUに返却しました。`);
                this.updateUI();
                this.disableBettingButtons(); // アクション確定のためボタン無効化
                

                setTimeout(() => {   
                     // 現在のプレイヤー（プレイヤー=0）のアクションを完了にする
                    this.hasActedThisRound[0] = true;                            // 全員のアクション完了とベット額の一致を正しく判定して分岐
                    if (this.checkAllPlayersActed() && this.playerBet === this.computerBet) {
                        this.checkBettingRoundComplete(); // 次のフェーズへ
                    } else {
                        this.nextPlayer(); // ターン交代
                    }
                }, 800);
        
            }, 3000);
        } else {
            this.updateUI();
            this.disableBettingButtons(); 
            setTimeout(() => {
                this.updateGameStatus(`${callAmount.toLocaleString()}ペリカコールしました。`);
                // アクション確定のためボタン無効化

                setTimeout(() => {   
                     // 現在のプレイヤー（プレイヤー=0）のアクションを完了にする
                    this.hasActedThisRound[0] = true;                            // 全員のアクション完了とベット額の一致を正しく判定して分岐
                    if (this.checkAllPlayersActed() && this.playerBet === this.computerBet) {
                        this.checkBettingRoundComplete(); // 次のフェーズへ
                    } else {
                        this.nextPlayer(); // ターン交代
                    }
                }, 800);


            }, 1000);
        }
        
    }

    showRaiseControls() {
        document.getElementById('betControls').style.display = 'flex';
        document.getElementById('betAmount').value = 10000000; // 初期値を1000万に変更
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
        const currentValue = parseInt(betInput.value) || 10000000;
        // 1000万ずつ増やし、プレイヤーの手持ち万を超えないようにする
        const newValue = Math.min(currentValue + 10000000, this.playerChips);
        betInput.value = newValue;
    }

    decreaseBetAmount() {
        const betInput = document.getElementById('betAmount');
        const currentValue = parseInt(betInput.value) || 10000000;
        // 1000万ずつ減らし、最低でも1000万にする
        const newValue = Math.max(currentValue - 10000000, 10000000);
        betInput.value = newValue;
    }

    confirmRaise() {
        console.log("Current Phase:", this.gamePhase, "Player:", this.currentPlayer);
        
        // 入力された額＝「今出している分に『追加で上乗せする』額」として扱う
        const additionalRaiseAmount = parseInt(document.getElementById('betAmount').value);
        if (isNaN(additionalRaiseAmount) || additionalRaiseAmount <= 0) {
            this.updateGameStatus('有効な万数を入力してください。');
            return;
        }
        
        // プレイヤーの新しい合計ベット額を計算
        const totalBet = this.playerBet + additionalRaiseAmount;
        
        // 今回手元から削る必要がある万額（入力された額そのもの）
        const needed = additionalRaiseAmount;
        
        if (needed > this.playerChips) {
            this.updateGameStatus(`ペリカが不足しています。必要: ${needed.toLocaleString()}ペリカ（手持ち: ${this.playerChips.toLocaleString()}ペリカ）`);
            return;
        }
        
        // 残高全額を上乗せしようとしているか（オールイン判定）
        const isAllIn = (needed === this.playerChips);
        
        // CPUがすでにレイズしている場合、その額に追いついた上でさらに上乗せできているかチェック（オールイン時は例外）
        if (this.computerBet > this.playerBet && totalBet < this.computerBet && !isAllIn) {
            const minTotalBet = this.computerBet;
            const minAdd = minTotalBet - this.playerBet;
            this.updateGameStatus(`ハンチョウのベット額（${this.computerBet.toLocaleString()}ペリカ）に対抗するには、最低でも${minAdd.toLocaleString()}ペリカ以上を入力してください。`);
            return;
        }
        
        // 万計算とベット額の反映
        this.playerChips = Math.max(0, this.playerChips - needed);
        
        this.pot += needed;
        this.playerBet = totalBet;
        this.currentBet = totalBet;
        
        this.player_reisuse = true;
        this.hideRaiseControls();
        this.updateUI();
        
        // プレイヤーが全額突っ込んだ（オールイン）場合の処理
        if (this.playerChips === 0) {
            this.updateGameStatus(`プレイヤーが手持ちの${needed}ペリカすべてを上乗せしてオールインレイズしました！`);
            
            this.checkAllInStatus();

            // 相手（CPU）にコールするかフォールドするかを判断させるため、手番を回す
            this.hasActedThisRound = [false, false];
            this.hasActedThisRound[0] = true; // プレイヤーはアクション完了
            
            this.disableBettingButtons();
            setTimeout(() => {
                this.nextPlayer(); // CPUのターンへ交代
            }, 3000);
            return;
        }
        
        // 通常のレイズ時の処理
        this.updateGameStatus(`${needed.toLocaleString()}ペリカを追加して、合計${totalBet.toLocaleString()}ペリカにレイズしました。`);
        
        this.hasActedThisRound = [false, false];
        this.hasActedThisRound[0] = true; // レイズした本人はアクション済み
        
        this.disableBettingButtons();
        
        setTimeout(() => {
            if (this.currentPlayer === 1) {
                console.log('ハンチョウのターンです');
            } else {
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
        this.hasActedThisRound[this.currentPlayer] = true;
        this.currentPlayer = 1 - this.currentPlayer;
        
        if (this.checkAllPlayersActed()) {
            this.checkBettingRoundComplete(); // 次のフェーズへ進む
        }
        else if (this.currentPlayer === 0) {
            this.enableBettingButtons();
        } else {
            console.log('ハンチョウのターンを開始します');
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
        const activePlayers = [];
        
        if (this.playerBet >= 0) activePlayers.push(0);
        if (this.computerBet >= 0) activePlayers.push(1);
        
        if (activePlayers.length === 1) {
            return true;
        }
        
        return activePlayers.every(index => this.hasActedThisRound[index]);
    }

    // ベッティングラウンドが完了したかチェック
    checkBettingRoundComplete() {
        const activePlayers = [];
        
        if (this.playerBet >= 0) activePlayers.push(0);
        if (this.computerBet >= 0) activePlayers.push(1);
        
        if (activePlayers.length === 1) {
            this.gamePhase = 'showdown';
            this.showdown();
            return;
        }
        
        // オールインチェック
        const allInPlayers = [];
        if (this.playerChips === 0 && this.playerBet > 0) allInPlayers.push(0);
        if (this.computerChips === 0 && this.computerBet > 0) allInPlayers.push(1);
        
        if (allInPlayers.length === 1 && activePlayers.length === 2) {
            while (this.communityCards.length < 5) {
                this.communityCards.push(this.deck.deal());
            }
            this.gamePhase = 'showdown';
            this.updateGameStatus('オールイン！すべてのカードをオープンします。');
            this.updateUI(); // ★追加：残りのコミュニティカードを表示し、めくるSEを再生する
            setTimeout(() => this.showdown(), 1500);
            return;
        }
        
        let allBetsMatch = true;
        for (const playerIndex of activePlayers) {
            const bet = playerIndex === 0 ? this.playerBet : this.computerBet;
            if (bet !== this.currentBet) {
                allBetsMatch = false;
                break;
            }
        }
        
        if (allBetsMatch && this.checkAllPlayersActed()) {
            this.nextPhase(); 
        }
    }

    // ★★★ 強く調整したCPU思考ロジック（羽振り調整版） ★★★
   computerAction() {
        console.log('思考ロジック強化版 computerAction が呼び出されました');
        
        const hand = this.computerHand;
        const cpuChips = this.computerChips;
        const cpuCurrentBet = this.computerBet;
        const playerName = 'ハンチョウ';
        
        // 1. ハンドの純粋な強さを評価 (0 ~ 8)
        const computerHandEval = HandEvaluator.evaluateHand([...hand, ...this.communityCards]);
        const handRank = computerHandEval.rank; 
        
        // 2. コール要求額とポットオッズの算出
        const callAmount = this.currentBet - cpuCurrentBet;
        const totalPot = this.pot;
        const potOdds = callAmount > 0 ? callAmount / (totalPot + callAmount) : 0;
        
        // 3. 次のカードで大逆転できる可能性（ドロー関係）のチェック
        const hasFlushDraw = this.checkFlushDraw(hand, this.communityCards);
        const hasStraightDraw = this.checkStraightDraw(hand, this.communityCards);
        const hasStrongDraw = (hasFlushDraw || hasStraightDraw) && this.gamePhase !== 'river';

        // 4. 現フェーズに合わせたハンド評価値のスコアリング化(0.0 ~ 1.0)
        let handStrength = 0.0;
        
        if (this.gamePhase === 'preflop') {
            handStrength = this.evaluatePreflopHand(hand);
        } else {
            handStrength = Math.min(handRank / 4.0, 1.0); 
            if (hasStrongDraw) {
                handStrength = Math.max(handStrength, 0.45); 
            }
        }

        const random = Math.random();
        
        const updateChipsAndBet = (amount, newBet) => {
            this.computerChips = Math.max(0, this.computerChips - amount);
            this.computerBet = newBet;
        };

        // ====================================================
        // 【修正箇所】CPUの羽振りをプレイヤーの所持金によって変える
        // ====================================================
        const determineHafuriAmount = () => {
            // プレイヤーの現在の所持チップ（chips または this.playerChips）
            // ※お使いのゲームオブジェクトの変数名に合わせて調整してください（通常は this.playerChips や this.chips）
            const playerChips = this.chips || this.playerChips || 100000000;

            // プレイヤーの所持金の「40% 〜 60%」の間でランダムに割合を決める
            const randomRatio = 0.4 + (Math.random() * 0.2);
            let calculatedAmount = Math.floor(playerChips * randomRatio);

            // 1000万未満の端数を切り捨てて綺麗な数字にする（例: 4520万 ➡️ 4500万）
            calculatedAmount = Math.floor(calculatedAmount / 10000000) * 10000000;

            // 最低でも100万（または100点）はレイズするように制限
            if (calculatedAmount < 1000000) calculatedAmount = 1000000;

            return calculatedAmount;
        };

        // ----------------------------------------------------
        // シチュエーション1：プレイヤーがベット・レイズを仕掛けてきている場合
        // ----------------------------------------------------
        if (this.player_reisuse === true || callAmount > 0) {
            this.player_reisuse = false; // フラグの消化

            let foldThreshold = potOdds * 0.85; 
            if (callAmount / totalPot > 1.2 && handStrength < 0.6) {
                foldThreshold += 0.15;
            }

            // ====================================================
            // 【修正】プレイヤーの全財産に対するベット額の割合でフォールド率を変化
            // ====================================================
            const playerCurrentChips = this.chips || this.playerChips || 100000000;
            const playerTotalWealth = playerCurrentChips + this.playerBet;

            if (playerTotalWealth > 0) {
                // 今回の要求額が、プレイヤーの全財産の何％にあたるかを計算 (0.0 〜 1.0)
                const betPercentageOfWealth = callAmount / playerTotalWealth;

                // ％に応じたフォールドしきい値の補正
                if (betPercentageOfWealth >= 0.70) {
                    foldThreshold += 0.15; // 70%以上の大勝負には大警戒（大幅に降りやすくなる）
                } else if (betPercentageOfWealth >= 0.40) {
                    foldThreshold += 0.05; // 40%〜70%のベットにもそこそこ警戒
                } else if (betPercentageOfWealth <= 0.40) {
                    foldThreshold -= 0.10; // 全財産の30%以下のベットなら、CPUはほぼ降りない（強気で見に行く）
                }
            }

            // フォールド処理（％補正が加わった foldThreshold で判定）
            if (handStrength < foldThreshold && !hasStrongDraw && random < 0.8) {
                this.updateGameStatus(`${playerName}がフォールドしました。`);
                this.computerBet = -1;
                this.disableBettingButtons();
                setTimeout(() => this.checkBettingRoundComplete(), 1000);
                return;
            }
            
            // リレイズ(3ベット)の判定
            const canRaise = cpuChips > (this.currentBet - cpuCurrentBet) + 100;
            const wantsToValueRaise = handStrength > 0.75 && random < 0.45;
            const wantsToSemiBluff = hasStrongDraw && random < 0.25;

            if ((wantsToValueRaise || wantsToSemiBluff) && canRaise) {
                // 【連動】プレイヤーの所持金ベースで額を決定
                let raiseSize = determineHafuriAmount();
                
                // 所持万を超えないように安全弁をかける
                raiseSize = Math.min(raiseSize, cpuChips - callAmount); 
                if (raiseSize < 100) raiseSize = 100; 

                const totalNewBet = this.currentBet + raiseSize;
                const addedAmount = totalNewBet - cpuCurrentBet;

                updateChipsAndBet(addedAmount, totalNewBet);
                this.pot += addedAmount;
                this.currentBet = totalNewBet;
                
                this.updateGameStatus(`${playerName}がさらに${raiseSize.toLocaleString()}ペリカレイズしました！`);
                this.triggerCpuRaiseUI(raiseSize);
                setTimeout(() => {
                    return;
                }, 1000);
            }

            // 通常のコール処理
            updateChipsAndBet(callAmount, this.currentBet);
            this.pot += callAmount;
            this.updateGameStatus(`${playerName}が${callAmount.toLocaleString()}ペリカコールしました。`);
            this.updateUI();
            this.disableBettingButtons();
            setTimeout(() => {
                if (this.checkAllPlayersActed()) this.checkBettingRoundComplete();
                else this.nextPlayer();
            }, 1000);

        } 
        // ----------------------------------------------------
        // シチュエーション2：場がチェックで回ってきた場合（積極的なベット検討）
        // ----------------------------------------------------
        else {
            const isValueBet = handStrength > 0.35 && random < 0.65; 
            const isSemiBluff = hasStrongDraw && random < 0.35;      
            const isPureBluff = this.gamePhase === 'river' && handRank === 0 && random < 0.12; 

            const canBet = cpuChips >= 100;

            if ((isValueBet || isSemiBluff || isPureBluff) && canBet) {
                // 【連動】プレイヤーの所持金ベースで額を決定
                let betAmount = determineHafuriAmount();
                
                // 所持万を超えないように調整
                betAmount = Math.min(betAmount, cpuChips); 
                
                updateChipsAndBet(betAmount, cpuCurrentBet + betAmount);
                this.pot += betAmount;
                this.currentBet = cpuCurrentBet + betAmount;
                
                this.updateGameStatus(`${playerName}が${betAmount.toLocaleString()}ペリカベットしました。`);
                this.triggerCpuRaiseUI(betAmount);
            } else {
                this.updateGameStatus(`${playerName}がチェックしました。`);
                this.updateUI();
                this.disableBettingButtons();
                setTimeout(() => {
                    if (this.checkAllPlayersActed()) this.checkBettingRoundComplete();
                    else this.nextPlayer();
                }, 800);
            }
        }
    }

    // プリフロップハンド(2枚)のポテンシャルを判定する評価関数
    evaluatePreflopHand(hand) {
        const card1 = hand[0];
        const card2 = hand[1];
        
        const isPair = card1.suit === card2.suit; // ※既存Cardクラスのバグ防止として安全に
        const highRank = Math.max(card1.rank, card2.rank);
        const lowRank = Math.min(card1.rank, card2.rank);
        const gap = highRank - lowRank;

        let score = 0.15; // 最低保証スコア

        // ポケットペアの評価
        if (card1.rank === card2.rank) {
            score += 0.45;
            if (highRank >= 10) score += 0.25; // TT, JJ, QQ, KK, AAは最強
        } else {
            if (highRank >= 11) score += 0.15; // 絵札/Aを1枚でも持っている
            if (lowRank >= 10) score += 0.15;  // 2枚とも10以上
            if (card1.suit === card2.suit) score += 0.08; // スーテッド（同じマーク）
            if (gap === 1) score += 0.07;      // コネクター（数字が連続）
        }
        return Math.min(score, 1.0);
    }

    // フラッシュドローの判定（手札＋コミュニティで同じスートが4枚あるか）
    checkFlushDraw(hand, community) {
        const all = [...hand, ...community];
        const counts = {};
        all.forEach(c => counts[c.suit] = (counts[c.suit] || 0) + 1);
        return Object.values(counts).some(count => count === 4);
    }

    // ストレートドローの判定（数字の並びが4連続または1個抜けの4枚か）
    checkStraightDraw(hand, community) {
        const all = [...hand, ...community];
        const ranks = [...new Set(all.map(c => c.rank))].sort((a, b) => b - a);
        if (ranks.length < 4) return false;

        for (let i = 0; i <= ranks.length - 4; i++) {
            if (ranks[i] - ranks[i+3] === 3) return true; // 4連続（オープンエンド）
            if (ranks[i] - ranks[i+3] === 4) return true; // 1つ抜け（ガットショット）
        }
        // Aを1として計算する特殊ケース処理
        if (ranks.includes(14)) {
            const lowRanks = ranks.map(r => r === 14 ? 1 : r).sort((a, b) => b - a);
            for (let i = 0; i <= lowRanks.length - 4; i++) {
                if (lowRanks[i] - lowRanks[i+3] <= 4) return true;
            }
        }
        return false;
    }

    // CPUのベット時のUIとターン管理の共通化メソッド
    triggerCpuRaiseUI(amount) {
        this.hasActedThisRound = [false, false];
        this.hasActedThisRound[1] = true; 
        
        document.getElementById('cpuRaiseStatus').style.display = 'block';
        document.getElementById('cpuRaiseAmount').textContent = amount;
        
        this.updateUI();
        this.disableBettingButtons();
        setTimeout(() => {
            if (this.currentPlayer === 0) this.enableBettingButtons();
            else this.nextPlayer();
        }, 800);
    }

    nextPhase() {
        this.disableBettingButtons();
        document.getElementById('cpuRaiseStatus').style.display = 'none';
        
        this.playerBet = 0;
        this.computerBet = 0;
        this.currentBet = 0;
        this.currentPlayer = 0; 
        this.hasActedThisRound = [false, false]; 
        
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
        
        setTimeout(() => {
            if (this.currentPlayer === 0) {
                this.enableBettingButtons();
            }
        }, 800); 
    }

    showdown() {
        this.gamePhase = 'showdown';

        // ★ここを追加：結果画面（ショーダウン）に入ったので、ざわざわ演出とBGMを止める
        document.body.classList.remove('all-in-active');
        const zawaBgm = document.getElementById('zawazawaBgm');
        if (zawaBgm) {
            zawaBgm.pause();
            zawaBgm.currentTime = 0;
        }
        VolumeManager.applyBgm(); // 通常BGMの音量を戻す（勝敗決定の瞬間に通常BGMが流れます）
        
        const hands = [
            { player: 0, hand: HandEvaluator.evaluateHand([...this.playerHand, ...this.communityCards]), name: 'プレイヤー' },
            { player: 1, hand: HandEvaluator.evaluateHand([...this.computerHand, ...this.communityCards]), name: 'ハンチョウ' }
        ];
        
        const bets = [this.playerBet, this.computerBet];
        const activeHands = hands.filter((h, i) => bets[i] >= 0); 
        
        activeHands.sort((a, b) => HandEvaluator.compareHands(b.hand, a.hand));
        
        let comparisonMessage = `ショーダウン！\n`;
        
        if (this.playerBet >= 0) {
            const playerHand = hands[0];
            document.getElementById('playerHandRank').textContent = playerHand.hand.rankName || playerHand.hand.name;
            comparisonMessage += `プレイヤー: ${playerHand.hand.rankName || playerHand.hand.name}\n`;
        } else {
            document.getElementById('playerHandRank').textContent = 'フォールド';
            comparisonMessage += `プレイヤー: フォールド\n`;
        }
        
        if (this.computerBet >= 0) {
            const computerHand = hands[1];
            document.getElementById('computerHandRank').textContent = computerHand.hand.rankName || computerHand.hand.name;
            comparisonMessage += `ハンチョウ: ${computerHand.hand.rankName || computerHand.hand.name}\n`;
        } else {
            document.getElementById('computerHandRank').textContent = 'フォールド';
            comparisonMessage += `ハンチョウ: フォールド\n`;
        }
        
        const winner = activeHands[0]; 
        
        const winners = activeHands.filter(h => 
            HandEvaluator.compareHands(h.hand, winner.hand) === 0
        );
        
        if (winners.length === 1) {
            this.endRound(winner.player);
        } else {
            document.body.classList.remove('all-in-active');
            const shareAmount = Math.floor(this.pot / winners.length);
            
            comparisonMessage = `\n引き分け！${shareAmount.toLocaleString()}ペリカずつ獲得！`;
            this.updateGameStatus(comparisonMessage);
            
            winners.forEach(w => {
                if (w.player === 0) this.playerChips += shareAmount;
                else if (w.player === 1) this.computerChips += shareAmount;
            });
            
            document.querySelectorAll('.player-area').forEach(area => {
                area.style.background = 'linear-gradient(135deg, rgba(255, 193, 7, 0.3), rgba(255, 235, 59, 0.3))';
                area.style.border = '2px solid #ffc107';
                area.style.boxShadow = '0 0 20px rgba(255, 193, 7, 0.5)';
            });
            
            this.updateUI();
            this.disableBettingButtons();
            
            setTimeout(() => {
                document.body.classList.remove('all-in-active');
                this.updateGameStatus('ゲーム終了。新しいゲームを開始するにはページを更新してください。');
                document.querySelectorAll('.player-area').forEach(area => {
                    area.style.background = '';
                    area.style.border = '';
                    area.style.boxShadow = '';
                });
            }, 800);
            setTimeout(() => {
                this.gamePhase = 'ended';
            }, 2000);
        }
    }

    enableBettingButtons() {
        console.log("Current Phase:", this.gamePhase, "Player:", this.currentPlayer);
        if (this.gamePhase === 'ended') {
            return;
        }
        document.getElementById('checkBtn').disabled = false;
        document.getElementById('callBtn').disabled = false;
        document.getElementById('raiseBtn').disabled = false;
        document.getElementById('foldBtn').disabled = false;
        this.hideRaiseControls();
    }

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
            // 記号からクラス名（英語）へ変換する辞書
            const suitMap = { '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs', '♠': 'spades' };
            const suitSymbol = card.suit; // ログより記号が入っていることが判明
            const suitClass = suitMap[suitSymbol] || 'spades'; // 記号がなければデフォルトでスペード

            cardDiv.className = `card ${suitClass}`;
            
            // rankが文字列の "J" などでも対応できるようにする
            const rankDisplay = card.rank;
            
            cardDiv.innerHTML = `<div class="suit">${suitSymbol}</div><div class="rank">${rankDisplay}</div>`;

            // 音再生
            setTimeout(() => {
                const flipSe = document.getElementById('cardFlipSe');
                if (flipSe) {
                    flipSe.currentTime = 0;
                    flipSe.play().catch(e => console.log("SE再生エラー:", e));
                }
            }, 50);
            
        } else {
            cardDiv.className = 'card back';
            cardDiv.textContent = '?';
        }
        
        return cardDiv;
    }
    
    

    endRound(winner) {
        document.body.classList.remove('all-in-active');
        const zawaBgm = document.getElementById('zawazawaBgm');
        if (zawaBgm) {
            zawaBgm.pause();
            zawaBgm.currentTime = 0;
        }
        VolumeManager.applyBgm();
        
        localStorage.setItem('shared_chips', this.playerChips);
        this.gamePhase = 'ended'; // 演出が入る前にフェーズをendedへ移行
        
        if (winner === 0) {
            this.playerChips += this.pot;
            this.updateGameStatus('🎉 プレイヤーの勝利！🎉 ' + this.pot.toLocaleString() + 'ペリカのポットを獲得しました！');
            // 【修正】HTMLの構造に合わせて、2番目（最後）の要素であるプレイヤーエリアを緑にハイライト
            document.querySelector('.player-area:last-child').style.background = 'linear-gradient(135deg, rgba(76, 175, 80, 0.3), rgba(139, 195, 74, 0.3))';
            document.querySelector('.player-area:last-child').style.border = '2px solid #4caf50';
            document.querySelector('.player-area:last-child').style.boxShadow = '0 0 20px rgba(76, 175, 80, 0.5)';
        } else {
            this.computerChips += this.pot;
            this.updateGameStatus('ハンチョウの勝利！ ' + this.pot.toLocaleString() + 'ペリカのポットを獲得しました！');
            // 【修正】HTMLの構造に合わせて、1番目の要素であるコンピューターエリアを赤（敗北/または敵勝利のハイライト）に変更
            document.querySelector('.player-area:first-child').style.background = 'linear-gradient(135deg, rgba(76, 175, 80, 0.3), rgba(139, 195, 74, 0.3))';
            document.querySelector('.player-area:first-child').style.border = '2px solid #4caf50';
            document.querySelector('.player-area:first-child').style.boxShadow = '0 0 20px rgba(76, 175, 80, 0.5)';
        }
        
        this.updateUI();
        this.disableBettingButtons();
        
        setTimeout(() => {
            document.body.classList.remove('all-in-active');
        // ★★★ 所持金がゼロ（破産）になった場合の処理を追加 ★★★
            if (this.playerChips === 0) {
                this.updateGameStatus('破産しました…強制退室します。');
                localStorage.setItem('bugging_cash', 0); // ローカルストレージも0に更新
                
                // 1.5秒だけ破産メッセージを見せてからホームへ戻る
                setTimeout(() => {
                    window.location.href = '../home.html';
                }, 1500);
                return; // ここで処理を終了し、下の「新しいゲーム」ボタン復活などはさせない
            }

            if (this.playerChips >= 24000000000) {
                this.updateGameStatus('240億ペリカ達成…！ホームに戻ります。');
                
                setTimeout(() => {
                    window.location.href = '../home.html';
                }, 1500);

                return; // 以降の処理を中断
            }

            this.updateGameStatus('ゲーム終了。新しいゲームを開始するにはページを更新してください。');
            document.getElementById('newGameBtn').disabled = false;
            document.querySelectorAll('.player-area').forEach(area => {
                area.style.background = '';
                area.style.border = '';
                area.style.boxShadow = '';
            });
        }, 3000);
    }
    
    // 【追加】プレイヤーがオールイン（残高0）になったか判定して画面をざわざわさせる関数
    checkAllInStatus() {
        if (this.playerChips === 0 && this.gamePhase !== 'ended' && this.gamePhase !== 'waiting') {
            document.body.classList.add('all-in-active');

            // ざわつきBGMの再生コントロール
            const zawaBgm = document.getElementById('zawazawaBgm');
            if (zawaBgm && zawaBgm.paused) {
                zawaBgm.volume = 0; // 一旦ミュートで再生開始して
                zawaBgm.play().catch(err => console.log("ざわBGM再生エラー:", err));
            }
            
            // 音量バランスを再計算（通常BGMを0に、ざわBGMを現在の音量に）
            VolumeManager.applyBgm();
        }
    }
    

    // ★★★ HTML構造に合わせて最適化したUI更新メソッド ★★★
    updateUI() {
        localStorage.setItem('bugging_cash', this.playerChips);

        if (this.communityCards && this.communityCards.length > this.lastCommunityCardsCount) {
            // 前回のカード枚数より増えていたら、カードをめくるSEを再生
            playCardFlipSe();
        }
        // 現在の枚数を記憶する（ゲームがリセットされて0枚になった時も自動追従します）
        this.lastCommunityCardsCount = this.communityCards ? this.communityCards.length : 0;


        if (this.gamePhase === 'showdown' && this.lastGamePhase !== 'showdown') {
            playImpactSe();
        }
        // 現在のフェーズを記憶する
        this.lastGamePhase = this.gamePhase;



        console.log("Current Phase:", this.gamePhase, "Player:", this.currentPlayer);
        document.getElementById('potAmount').textContent = this.pot.toLocaleString(); // 修正
        document.getElementById('playerChips').textContent = this.playerChips.toLocaleString(); // 修正
        document.getElementById('computerChips').textContent = this.computerChips.toLocaleString(); // 修正
        
        // HTMLの現在のベット額テキストパーツを安全に更新
        const currentBetDisplay = document.getElementById('currentBetDisplay');
        if (currentBetDisplay) {
            currentBetDisplay.textContent = this.currentBet.toLocaleString(); // 修正
        }
        
        const communityDiv = document.getElementById('communityCards');
        communityDiv.innerHTML = '';
        this.communityCards.forEach(card => communityDiv.appendChild(this.createCardElement(card)));
        
        const playerDiv = document.getElementById('playerCards');
        playerDiv.innerHTML = '';
        this.playerHand.forEach(card => playerDiv.appendChild(this.createCardElement(card)));
        
        const computerDiv = document.getElementById('computerCards');
        communityDiv.innerHTML = ''; // 一旦クリアしてから差し替え
        this.communityCards.forEach(card => communityDiv.appendChild(this.createCardElement(card)));

        // computerHandの表示
        computerDiv.innerHTML = '';
        // ended（勝敗決定後）または showdown の時はCPUのカードをオープンする
        const isHidden = this.gamePhase !== 'showdown' && this.gamePhase !== 'ended' && this.gamePhase !== 'waiting';
        this.computerHand.forEach(card => computerDiv.appendChild(this.createCardElement(card, isHidden)));
        
        // 役のリアルタイム常時表示ロジック（ended時も表示を維持する）
        if (this.gamePhase !== 'waiting') {
            // プレイヤーの役を更新
            if (this.playerHand.length > 0 && this.playerBet >= 0) {
                const currentBestHand = HandEvaluator.evaluateHand([...this.playerHand, ...this.communityCards]);
                document.getElementById('playerHandRank').textContent = currentBestHand.rankName || currentBestHand.name;
            } else if (this.playerBet === -1) {
                document.getElementById('playerHandRank').textContent = 'フォールド';
            }

            // コンピューターの役表示（showdown または ended の時は確定役を表示）
            if (this.computerHand.length > 0 && this.computerBet >= 0) {
                if (this.gamePhase === 'showdown' || this.gamePhase === 'ended') {
                    const currentBestHand = HandEvaluator.evaluateHand([...this.computerHand, ...this.communityCards]);
                    document.getElementById('computerHandRank').textContent = currentBestHand.rankName || currentBestHand.name;
                } else {
                    document.getElementById('computerHandRank').textContent = '？？？';
                }
            } else if (this.computerBet === -1) {
                document.getElementById('computerHandRank').textContent = 'フォールド';
            }
        } else {
            // ゲーム開始前の初期状態（waiting）のみクリア
            ['playerHandRank', 'computerHandRank'].forEach(id => {
                const div = document.getElementById(id);
                if (div) div.textContent = '';
            });
        }
    }
}

// ==================== 音量管理 ====================
const VolumeManager = {
    bgmBase: 0.20,   // BGMの基準音量（スライダー初期値 20/100 に対応）
    seBase:  0.50,   // SEの基準音量（スライダー初期値 50/100 に対応）
    muted: false,

    // SE音量を0〜1で取得
    getSeVolume() {
        if (this.muted) return 0;
        const slider = document.getElementById('seVolume');
        return slider ? parseInt(slider.value) / 100 : this.seBase;
    },

    // BGM音量を0〜1で取得
    getBgmVolume() {
        if (this.muted) return 0;
        const slider = document.getElementById('bgmVolume');
        return slider ? parseInt(slider.value) / 100 : this.bgmBase;
    },

    // BGMに現在の音量を即時適用
    applyBgm() {
        const bgm = document.getElementById('bgm');
        const zawaBgm = document.getElementById('zawazawaBgm');
        const isAllIn = document.body.classList.contains('all-in-active');

        // 通常のBGM音量
        if (bgm) {
            bgm.volume = isAllIn ? 0 : this.getBgmVolume();
        }
        // ざわつきBGMの音量（オールイン時のみ音を出す）
        if (zawaBgm) {
            zawaBgm.volume = isAllIn ? this.getBgmVolume() : 0;
        }
    },

    // ミュートアイコンを状態に応じて切り替え
    updateMuteIcon() {
        const btn = document.getElementById('masterMuteBtn');
        if (!btn) return;
        btn.textContent = this.muted ? '🔇' : '🔊';
    }
};

// スライダー・ミュートボタンのイベントを初期化
function initVolumeControls() {
    const bgmSlider = document.getElementById('bgmVolume');
    const seSlider  = document.getElementById('seVolume');
    const muteBtn   = document.getElementById('masterMuteBtn');

    if (bgmSlider) {
        bgmSlider.addEventListener('input', () => VolumeManager.applyBgm());
    }
    if (seSlider) {
        // SE確認：スライダーを動かしたらクリック音を1回再生
        seSlider.addEventListener('change', () => playClickSe());
    }
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            VolumeManager.muted = !VolumeManager.muted;
            VolumeManager.updateMuteIcon();
            VolumeManager.applyBgm();
        });
    }
}

document.addEventListener('DOMContentLoaded', initVolumeControls);

// ==================== SE再生関数 ====================
function playClickSe() {
    const se = document.getElementById('clickSe');
    if (se) {
        se.currentTime = 0;
        se.volume = VolumeManager.getSeVolume();
        se.play().catch(err => console.log("SE再生エラー:", err));
    }
}

function playCardFlipSe() {
    const se = document.getElementById('cardFlipSe');
    if (se) {
        se.currentTime = 0;
        se.volume = VolumeManager.getSeVolume();
        se.play().catch(err => console.log("SE再生エラー:", err));
    }
}

function playImpactSe() {
    const se = document.getElementById('impactSe');
    if (se) {
        se.currentTime = 0;
        // 衝撃音は少し強めにする（SE音量の1.5倍、上限1.0）
        se.volume = Math.min(VolumeManager.getSeVolume() * 1.5, 1.0);
        se.play().catch(err => console.log("SE再生エラー:", err));
    }
}
const game = new PokerGame();

// ─── 音量管理と自動再生の統合スクリプト ───
document.addEventListener("DOMContentLoaded", () => {
    const volSlider = document.getElementById("global-volume-slider");
    const volValText = document.getElementById("global-volume-val");
    const bgm = document.getElementById('bgm');

    // 音量バーの動作
    if (volSlider && volValText) {
        volSlider.oninput = (e) => {
            const volume = parseFloat(e.target.value);
            // BGMと効果音を一括制御するなら以下のように追加
            const allAudios = [bgm, document.getElementById('clickSe'), document.getElementById('cardFlipSe'), document.getElementById('impactSe')];
            allAudios.forEach(audio => { if(audio) audio.volume = volume; });
            
            volValText.innerText = Math.round(volume * 100) + "%";
        };
    }

    // 自動再生処理
    if (bgm) {
        bgm.volume = 0.2;
        bgm.play().catch(() => {
            console.log("自動再生ブロック。クリックで開始");
            const startAudio = () => {
                bgm.play();
                document.removeEventListener('click', startAudio);
            };
            document.addEventListener('click', startAudio, { once: true });
        });
    }
// 画面全体の初回クリックでBGMを再生（ブラウザ対策）
document.addEventListener('click', () => {
    // 例：新しいゲームボタン
document.getElementById('newGameBtn').addEventListener('click', () => {
    playClickSe(); // ★追加
    // 既存のゲーム開始処理...
});

// 例：チェックボタン
document.getElementById('checkBtn').addEventListener('click', () => {
    playClickSe(); // ★追加
    // 既存のチェック処理...
});

// 例：コールボタン
document.getElementById('callBtn').addEventListener('click', () => {
    playClickSe(); // ★追加
    // 既存のコール処理...
});

// 例：レイズボタン
document.getElementById('raiseBtn').addEventListener('click', () => {
    playClickSe(); // ★追加
    // 既存のレイズ処理...
});

// 例：フォールドボタン
document.getElementById('foldBtn').addEventListener('click', () => {
    playClickSe(); // ★追加
    // 既存のフォールド処理...
});

// 例：レイズの「確定」ボタン（bet-controls内）
document.getElementById('confirmRaiseBtn').addEventListener('click', () => {
    playClickSe(); // ★追加
    // 既存の確定処理...
});

    
    const bgm = document.getElementById('bgm');
    if (bgm && bgm.paused) {
        bgm.volume = VolumeManager.getBgmVolume();
        bgm.play().catch(err => console.log("再生エラー:", err));
    }
}, { once: true }); // once: true で1回だけ実行されるようにする



// 「ホームへ戻る」ボタンを押したときの処理
document.getElementById('homeBtn').addEventListener('click', () => {
    localStorage.setItem('bugging_cash', game.playerChips);
    window.location.href = '../home.html'; 
});