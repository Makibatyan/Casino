# カイジのブラックジャック

HTML / CSS / JavaScript のブラックジャックゲームです。

## 起動方法

```bash
cd blackjack
python3 -m http.server 8765
```

ブラウザで `http://localhost:8765/index.html` を開いてください。

## 効果音について

- 効果音はすべて **`sounds/` フォルダ内の MP3** またはブラウザ内の合成音です
- **ダウンロードフォルダや絶対パスは使いません**（GitHub に clone した人も同じように鳴ります）
- 詳細は [sounds/README.md](sounds/README.md) を参照

## ファイル構成

```
blackjack/
├── index.html
├── styles.css
├── game.js
├── sounds.js
└── sounds/          ← 効果音 MP3（リポジトリに含める）
    ├── coin-low.mp3
    ├── coin-high.mp3
    ├── card-flip.mp3
    ├── voice-blackjack.mp3
    ├── voice-bust.mp3
    ├── voice-win.mp3
    ├── voice-lose.mp3
    └── voice-even.mp3
```
