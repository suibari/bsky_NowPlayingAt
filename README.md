# なうぷれあっと (bsky-nowplayingat)

> Bluesky と連携する、音楽の「今」を共有するアプリ

## 主な機能

### 再生中の曲を記録・投稿する

- 聴いている曲を「なうぷれ」として記録
- Bluesky のタイムラインに自動投稿（投稿頻度・文面はカスタマイズ可）
- Last.fm 連携で再生中の曲を自動取得

### フォロー中のユーザーの音楽を見る（Recommend タブ）

- Bluesky でフォローしているユーザーが今何を聴いているかを確認

### 全体のトレンドを見る（Everyone タブ）

- **Hot Tracks**：リアクションが多い注目曲
- **Hot Playlists**：人気のプレイリスト
- **Hot Users**：アクティブなユーザーランキング

### 楽曲を検索する

- 曲名・アーティスト名で検索
- Spotify / YouTube Music / Apple Music へのリンク付き

### リアクションする

- 楽曲にリアクション（絵文字）を送る
- リアクション数や最近のリアクターを確認

### プレイリストを作る・共有する

- お気に入りの曲をまとめてプレイリスト作成
- プレイリストをサムネイル付きで Bluesky に投稿

### ユーザープロフィール・履歴を見る

- 任意のユーザーの再生履歴・統計を閲覧
- リスニングレポートで傾向を把握

### 設定

- Last.fm アカウント連携
- 自動投稿の ON/OFF・投稿確率スライダー
- カスタム投稿テキスト・アートワーク添付
- 言語切り替え（日本語 / English）

---

## 開発

```sh
npm install
cp .env.example .env   # 値を埋める
npm run dev
```

本番ビルド：

```sh
npm run build
npm run preview
```

### ローカル開発環境での注意点

**必ず `http://127.0.0.1:5173` で開く。** ATProto の loopback client は
redirect_uri に `localhost` ではなく `127.0.0.1` を要求するため、`localhost` で開くと
サインイン後に 127.0.0.1 側へ移動し、セッション Cookie が別オリジンに付く。
`npm run dev` は 127.0.0.1 を表示するよう設定済み。

**サインイン**は loopback の public client（`token_endpoint_auth_method: none`）で動く。
PDS はローカルの client metadata を取得できないため、本番の confidential client は
サインインには使えない。

**oauth_sessions は本番と同じ DB を共有している。** そのため：

- ローカルでサインインすると、その DID のセッション行が public client のものに
  上書きされる。本番側は次のトークンリフレッシュでそのセッションを失効させるため、
  本番での再サインインが必要になる。自分の常用アカウントではなく開発用アカウントを使うこと。
- 既存セッションの restore（`/api/auto-post` など）は、保存されている authMethod を見て
  クライアントを選ぶ（`createSessionOAuthClient`）。本番で作られたセッション
  （`private_key_jwt`）は localhost からでも本番の confidential client で
  リフレッシュできる。PDS が必要とするのは公開されている
  `/client-metadata.json` の JWKS だけで、ローカルへの到達性は不要。
  ここで loopback client を使うとライブラリが `AuthMethodUnsatisfiableError` を投げ、
  セッション行が**削除される**（= 実ユーザーが強制サインアウトされる）。

**ほかのユーザーの再生履歴の収集**は poller（`bsky_NowPlayingAt_server`）の
`NOWPLAYINGAT_API_URL` をローカルに向ければ動く：

```sh
NOWPLAYINGAT_API_URL=http://127.0.0.1:5173 npm run dev
```

ただし本番 DB の enabled ユーザー全員が対象になり、**実際に各ユーザーの Bluesky へ投稿し、
PDS に history レコードを書き込む**。試す際は対象 DID を絞ること。

**KV（CACHE）は miniflare でローカルエミュレートされる**（`.wrangler/state` に保存）。
本番 KV とは別の空の名前空間で、TOP ページの「みんなのなうぷれ」「なうぷれライブ」
「なうぷれスタッツ」はすべてこの KV から配信されるため、初期状態ではサインインの有無に
関わらず全タブが空になる。本番の公開エンドポイントから同じデータを取ってきて
ローカル KV に流し込むには、dev サーバーを起動したまま別ターミナルで：

```sh
npm run seed:kv          # 既定で http://127.0.0.1:5173 に投入
npm run seed:kv -- http://127.0.0.1:5174
```

本番に対しては読み取りのみ。実データを自前で生成したい場合は poller を
ローカルに向けて動かす（`PUT /api/cache` で snapshot が書かれる）。

**`artists_*` と `user_stats` は `seed:kv` では入らない。** この2つを作るのは poller の
全履歴掃引だけで、本番にも一括で読み出す公開エンドポイントがない。ローカルに用意するには
poller を掃引モードで一度走らせる（全ユーザーの PDS を読むので数分かかる）：

```sh
cd ../bsky_NowPlayingAt_server
NOWPLAYINGAT_API_URL=http://127.0.0.1:5173 \
NOWPLAYINGAT_SHARED_SECRET=<このリポジトリの .env と同じ値> \
  npx tsx src/index.ts --stats-only
```

`--stats-only` は必須。付けないと `tick()` が動き、**実ユーザーの Bluesky に投稿する**。
共有シークレットが両リポジトリの `.env` で食い違っていると `/api/cache` が 401 を返し、
掃引は完走するのに KV が空のままになる。

### 画面の目視確認

`src/routes/+layout.ts` が `ssr = false` なので、`curl` は空のシェルしか返さない。
HTTP ステータスが 200 でも画面が真っ白なことがある。実ブラウザで見ること。

このマシンには共用の Playwright ハーネスが入っている（`~/tools/uitest`、詳細はそこの
README）。dev サーバーを起動したまま：

```sh
uishot --full-page http://127.0.0.1:5173/artist/サカナクション
uishot --viewport 400x900 http://127.0.0.1:5173/            # スマホ幅
```

スクリーンショットのパスと、コンソールエラー・失敗したリクエストが出力される。
サインアウト状態では `/api/me` の 401 と、独自プロフィール未作成ユーザーの
`com.suibari.nowplayingat.profile` に対する 400 が必ず出る。どちらも既存の正常動作。
