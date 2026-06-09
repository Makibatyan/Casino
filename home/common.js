// common.js
function checkAndRedirectClear() {
    const money = parseInt(localStorage.getItem("bugging_cash") || 0, 10);
    if (money >= 24000000000) {
        // 現在の場所からホーム画面のクリア画面へ遷移させる
        // パスは調整してください（例：../home/home.html）
        window.location.href = '../home/home.html?clear=true';
    }
}