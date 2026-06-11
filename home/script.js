// script.js
window.onload = function () {
    
    const currentMoney = parseInt(localStorage.getItem("bugging_cash")) || 100000000;
    
    updateMoneyStatus(currentMoney);

    showMoney();
    checkAndPlayDiff();
    checkBankruptcy();
    checkGameClear(); // ページ読み込み時にクリア判定を実行


    
      
    const bgm = document.getElementById("bgm");
    function playBgm() {
        bgm.muted = false;
        bgm.play().catch(e => console.log("再生ブロック中"));
    }
    document.body.addEventListener('click', playBgm, { once: true });
    playBgm();
};
function updateMoneyStatus(totalMoney) {
    const totalEl = document.getElementById("total-money");
    const goalEl = document.getElementById("remaining-goal");

    if (totalEl) totalEl.textContent = "¥" + totalMoney.toLocaleString();
    
    // 目標額 240億 からの差分を計算
    const GOAL_MONEY = 24000000000;
    const remaining = Math.max(0, GOAL_MONEY - totalMoney);
    
    if (goalEl) {
        if (remaining === 0) {
            goalEl.textContent = "達成";
            goalEl.style.color = "#d4a84b";
        } else {
            goalEl.textContent = "¥" + remaining.toLocaleString();
        }
    }
}




// ★ここが重要：所持金を判定するように修正しました
function checkGameClear() {
    const money = parseInt(localStorage.getItem("bugging_cash") || 0, 10);
    if (money >= 24000000000) {
        const clearScreen = document.getElementById("clear-screen");
        if (clearScreen) {
            clearScreen.style.display = "block";
            console.log("クリア判定成功：画面を表示します");
        }
    }
}

// 確実にDOMが読み込まれてから開始する
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("zawa-container");

    function spawnZawa() {
        if (!container) return;

        const zawa = document.createElement("div");
        zawa.className = "zawa-text";
        zawa.textContent = "ざわ…";
        
        // ランダムな配置
        zawa.style.left = Math.random() * (window.innerWidth - 100) + "px";
        zawa.style.top = Math.random() * (window.innerHeight - 50) + "px";
        
        // 初期状態：小さく、透明
        zawa.style.opacity = "0";
        zawa.style.transform = "scale(0.5)";
        zawa.style.fontSize = (Math.random() * 30 + 20) + "px";

        container.appendChild(zawa);

        // 表示と拡大のアニメーション
        setTimeout(() => {
            zawa.style.opacity = "0.8"; // ふわっと表示
            zawa.style.transform = "scale(2.0)"; // だんだん大きく
        }, 10);

        // 終了処理
        setTimeout(() => { 
            zawa.style.opacity = "0"; 
            setTimeout(() => zawa.remove(), 1500);
        }, 1500);
    }

    // 0.8秒ごとに生成
    setInterval(spawnZawa, 800);
});


function checkAndPlayDiff() {
    let diffRaw = localStorage.getItem("last_diff");
    if (!diffRaw || diffRaw === "0" || diffRaw === "null") return;

    let diff = parseInt(diffRaw, 10);
    if (isNaN(diff)) return;

    const container = document.getElementById("money-change");
    const textEl = document.getElementById("money-change-text");
    const imgEl = document.getElementById("money-change-img");
    
    if (!container || !textEl || !imgEl) return;

    let sign = diff > 0 ? "+" : "-"; 
    textEl.textContent = sign + "¥" + Math.abs(diff).toLocaleString();
    container.style.color = diff > 0 ? "gold" : "#ff4444";
    imgEl.src = diff > 0 ? "kaizi2.png" : "kaizi1.png";
}

function resetMoney() {
    // 1. 確実に「1億」という数値を文字列として保存する
    localStorage.setItem("bugging_cash", "100000000");
    
    // 2. 借金なども初期化しておく（必要なら）
    localStorage.setItem("bugging_debt", "500000000");
    localStorage.removeItem("last_diff");
    
    // 3. 画面の要素を強制的に隠す
    const gameOverScreen = document.getElementById("game-over-screen");
    if (gameOverScreen) {
        gameOverScreen.style.display = "none";
    }
    
    // 4. コンソールで確認してからリロード
    console.log("リセット完了、所持金:", localStorage.getItem("bugging_cash"));
    
    // 5. リロード
    location.reload();
}


function checkBankruptcy() {
    let money = parseInt(localStorage.getItem("bugging_cash")) || 0;
    const gameOverScreen = document.getElementById("game-over-screen");
    
    // 所持金が0以下なら破産、そうでないなら非表示にする
    if (money <= 0) {
        if (gameOverScreen) gameOverScreen.style.display = "block";
    } else {
        if (gameOverScreen) gameOverScreen.style.display = "none";
    }
}