# TYPE MATCH — 9属性の相性ビューア

攻撃を1属性、防御を最大2属性選び、相性を即時表示します。攻撃だけ選ぶと単属性9種と異なる複合属性36組を合わせた45候補を一つの一覧で表示し、防御だけ選ぶと攻撃9種を確認できます。候補をクリックすると反対側の属性に設定されます。

## 起動

```sh
npm install
npm run dev
```

表示されたローカルURLを開いてください。production buildはGitHub Pagesの `/aniimo-effectiveness/` 配下で配信される設定です。HTMLの直接オープンではなくHTTPサーバーを使用します。

## GitHub Pagesへの公開

このリポジトリは [https://takasyo.github.io/aniimo-effectiveness/](https://takasyo.github.io/aniimo-effectiveness/) での公開を想定しています。デフォルトブランチにpushするとGitHub Actionsがテストとproduction buildを実行し、成功後にGitHub Pagesへデプロイします。

初回のみ、GitHubリポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択してください。デプロイ状況は **Actions** タブから確認できます。

## 固定相性表

`public/data/type-chart.csv` に確定済みの相性を保存し、起動時に自動で読み込みます。属性は氷・水・雷・火・草・土・風・闇・光の9種類です。CSVのアップロード・ダウンロード機能はありません。

- UTF-8、カンマ区切り。見出し込み10行×10列。
- 1行目：先頭セルは見出し、残り9セルは防御属性名。
- 2〜10行目：先頭セルは攻撃属性名、残り9セルはその行の攻撃→各列の防御の倍率。
- 倍率は `0.625`（耐性）、`1`（等倍）、`1.6`（弱点）のいずれか。
- 攻撃・防御に同じ9属性を指定。空の属性名・重複・欠損値は不可。
- 列順が画面の表示順です。攻撃行の順序は自由です。
- 防御複合属性では倍率を掛け合わせます。例：`1.6 × 1.6 = 2.56`、`1.6 × 0.625 = 1`、`0.625 × 0.625 = 0.390625`。
- 表示は `2.56 / 1.6 / 1 / 0.625 / 0.390625` の5段階です。弱点と耐性の段階差から決定し、小数の計算誤差による分類ずれを防ぎます。
- 無効（0倍）など、指定された5段階以外のルールには対応していません。

## 属性アイコン

画像を `public/icons/` に配置し、`src/data/type-icons.ts` にCSVと同じ属性名をキーとして設定します。

```ts
export const typeIcons: Record<string, string> = {
  '火': 'icons/fire.png',
  '水': 'icons/water.png',
}
```

画像はPNG・WebP・SVGなどを使用できます。未登録・読込み失敗の場合は番号マーカーと属性名で表示します。属性名は画像提供後も表示されます。

## 検証

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

単体テストは相性の方向・5段階の倍率・CSV検証・36組の列挙・選択上限を確認します。ブラウザーテストはPC／スマホで固定相性表の表示、CSV操作の非表示、選択、リセット、キーボード操作、レイアウトを確認します。