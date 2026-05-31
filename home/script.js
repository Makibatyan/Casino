// script.js
window.onload = function () {
    showMoney();
    checkAndPlayDiff();
    checkBankruptcy();
    checkGameClear(); // ★ここに追加！

    const bgm = document.getElementById("bgm");

    // 音楽再生の試行
    function playBgm() {
        bgm.muted = false; // ミュート解除
        bgm.play().then(() => {
            console.log("音楽再生開始");
        }).catch(e => {
            console.log("自動再生がブロックされています");
        });
    }

    // 画面のどこかを一度クリックしたら再生
    document.body.addEventListener('click', () => {
        playBgm();
    }, { once: true }); // 一度だけ実行

    // 読み込み時にとりあえず再生してみる
    playBgm();
};

function checkBankruptcy() {
    let money = parseInt(localStorage.getItem("bugging_cash")) || 0;
    if (money <= 0) {
        document.getElementById("game-over-screen").style.display = "block";
    }
}

function resetMoney() {
    localStorage.setItem("bugging_cash", 10000000000);
    localStorage.removeItem("last_diff");
    location.reload();
}

function showMoney() {
    let money = parseInt(localStorage.getItem("bugging_cash")) || 0;
    const moneyEl = document.getElementById("money");
    if (moneyEl) moneyEl.textContent = money;
}


function checkGameClear() {
    const paid = parseInt(localStorage.getItem("bugging_paid")) || 0;
    if (paid >= 24000000000) {
        // ページを飛ばさず、要素を出すだけにする
        document.getElementById("clear-screen").style.display = "block";
    }
}
function checkAndPlayDiff() {
    let diffRaw = localStorage.getItem("last_diff");
    if (!diffRaw || diffRaw === "0" || diffRaw === "null") return;

    let diff = parseInt(diffRaw, 10);
    if (isNaN(diff)) return;

    const container = document.getElementById("money-change");
    const textEl = document.getElementById("money-change-text");
    const imgEl = document.getElementById("money-change-img");
    
    let sign = diff > 0 ? "+" : "-"; 
    textEl.textContent = sign + "¥" + Math.abs(diff).toLocaleString();
    container.style.color = diff > 0 ? "gold" : "#ff4444";
    imgEl.src = diff > 0 ? "kaizi2.png" : "kaizi1.png";

    container.style.opacity = 1;
    container.style.transform = "translateY(20px)";

    setTimeout(() => { container.style.transform = "translateY(0px)"; }, 50);
    setTimeout(() => { 
        container.style.opacity = 0; 
        localStorage.removeItem("last_diff"); 
    }, 4000);
}