// script.js の window.onload を以下のように修正してください
window.onload = function () {
    // 1. 所持金の計算と表示更新
    const currentMoney = parseInt(localStorage.getItem("bugging_cash")) || 100000000;
    updateMoneyStatus(currentMoney);

    // ★修正：showMoney(); を削除しました（定義されていないためエラーになる）
    
    // 2. 他の関数はそのまま
    checkAndPlayDiff();
    checkBankruptcy();
    checkGameClear();

    // 3. BGMの初期化と再生処理
    const bgm = document.getElementById("bgm");
    function playBgm() {
        bgm.muted = false;
        bgm.play().catch(e => console.log("自動再生ブロック中"));
    }
    document.body.addEventListener('click', playBgm, { once: true });
    playBgm();

    // script.js の window.onload 内に追加
    const volumeSlider = document.getElementById("volume-slider");
    if (volumeSlider && bgm) {
        // スライダーの値が変わった時に音量を更新
        volumeSlider.addEventListener("input", (e) => {
            bgm.volume = e.target.value;
        });
    }
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




function checkGameClear() {
    const money = parseInt(localStorage.getItem("bugging_cash") || 0, 10);
    const clearScreen = document.getElementById("clear-screen");
    
    // クリア判定（240億以上）かつ、現在のページがホームである場合のみ
    if (money >= 24000000000 && window.location.pathname.includes("home.html")) {
        if (clearScreen) {
            clearScreen.style.display = "block";
        }
    } else {
        // 条件を満たしていない、またはホーム以外なら非表示
        if (clearScreen) clearScreen.style.display = "none";
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


// 破産チェックを修正
function checkBankruptcy() {
    let money = parseInt(localStorage.getItem("bugging_cash") || 0, 10);
    const gameOverScreen = document.getElementById("game-over-screen");
    if (!gameOverScreen) return;

    if (money <= 10000000) {
        gameOverScreen.style.display = "block";
    } else {
        gameOverScreen.style.display = "none"; // 所持金がある時は隠す
    }
}

// 音楽が正しくHTMLから見つかっているか確認する
const bgmCheck = document.getElementById("bgm");
if (bgmCheck) {
    console.log("オーディオタグを見つけました！");
    console.log("ソース:", bgmCheck.querySelector('source').src);
} else {
    console.error("エラー：ID 'bgm' のオーディオタグが見つかりません！HTMLを確認してください。");
}