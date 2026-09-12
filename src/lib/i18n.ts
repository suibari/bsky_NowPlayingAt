import { writable, derived } from 'svelte/store';

export type Locale = 'ja' | 'en';

function getInitialLocale(): Locale {
  if (typeof localStorage !== 'undefined') {
    const v = localStorage.getItem('locale');
    if (v === 'en' || v === 'ja') return v;
  }
  return 'ja';
}

export const locale = writable<Locale>(getInitialLocale());

locale.subscribe((val) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('locale', val);
  }
});

export function toggleLocale() {
  locale.update((l) => (l === 'ja' ? 'en' : 'ja'));
}

const translations: Record<Locale, Record<string, string>> = {
  ja: {
    // --- Main page: banner ---
    'banner.bold': '再生履歴をBlueskyに自動投稿',
    'banner.desc': 'できます！Last.fm と連携してスマホ・PCで再生した曲を自動投稿しましょう。',
    'banner.cta': '設定はこちら →',

    // --- Main page: search ---
    'search.placeholder': '曲名、アーティスト名、アルバム名を入力',

    // --- Main page: tabs ---
    'tab.search': '曲を探す',
    'tab.recommend': 'おすすめ',
    'tab.hot': 'なうぷれチャート',
    'tab.discovery': 'みんなのなうぷれ',
    'everyone.realtime': 'リアルタイム',
    'recommend.loading': 'おすすめを読み込み中...',
    'recommend.empty': 'フォロー中のユーザーの再生履歴がまだありません。',
    'hot.toptracks': '曲',
    'hot.topplaylists': 'プレイリスト',
    'hot.topusers': 'ユーザー',
    'hot.trending': '急上昇',
    'hot.loadmore': 'もっと見る',
    'hot.loading': 'チャートを集計中...',
    'hot.empty.tracks': 'まだ急上昇中の曲がありません。',
    'hot.empty.playlists': 'まだ急上昇中のプレイリストがありません。',
    'hot.empty.users': 'まだ急上昇中のユーザーがいません。',
    'hot.users.count': '{{count}} 件の再生履歴',
    'discovery.loading': 'みんなのなうぷれを読み込み中...',

    // --- Main page: live users (right pane) ---
    'live.title': 'なうぷれライブ',
    'live.empty': '誰も聴いていません',

    // --- Main page: mix (right pane) ---
    'mix.title': 'なうぷれミックス',
    'mix.empty': 'おすすめの曲が見つかりません',
    'mix.recommended_by': 'からの今日のおすすめ',

    // --- Main page: global stats (right pane) ---
    'stats.title': 'なうぷれスタッツ',
    'stats.total': '総なうぷれ回数',
    'stats.daily': '日ごとのなうぷれ回数',
    'stats.tooltip.plays': '{{count}} 回再生',

    // --- Legal links ---
    'legal.terms': '利用規約',
    'legal.privacy': 'プライバシーポリシー',
    'legal.nav': '法的情報',

    // --- Main page: sign-in modal ---
    'signin.modal.title': 'サインイン',

    // --- Main page: discovery ---
    'discovery.listening': 'が聴いています',
    'discovery.reacted': 'がリアクションしました',
    'discovery.playlist': 'がプレイリストを作成しました',
    'discovery.empty': 'まだリアクションがありません。一番乗りしましょう！',
    'discovery.error': 'フィードを読み込めませんでした',
    'group.count': '{{count}}曲',
    'recommend.score': 'おすすめ度',
    'recommend.score.tooltip': 'なうぷれあっとの記録から求めた、あなたへのこの曲のおすすめ度です',

    // --- Main page: playlist modal ---
    'playlist.modal.title': 'プレイリストに追加',
    'playlist.modal.empty': 'プレイリストが見つかりません。プロフィールページから作成してください！',

    // --- Main page: login ---
    'redirect': 'リダイレクト中...',
    'signin': 'サインイン',

    // --- Alerts / confirms ---
    'confirm.post': '"{{title}}" をBlueskyに投稿しますか？',
    'alert.posted': 'Blueskyに投稿しました！',
    'alert.history': '再生履歴に登録しました！',
    'alert.failed': '処理に失敗しました: ',
    'alert.signinfailed': 'サインインに失敗しました: ',
    'alert.addedto': '"{{name}}" に追加しました！',
    'alert.addfailed': '追加に失敗しました: ',

    // --- Track count ---
    'tracks.count': '{{count}} 曲',

    // --- Settings page ---
    'settings.back': 'ホームに戻る',
    'settings.title': '設定',
    'settings.language.title': '言語設定',
    'settings.language.label': '表示言語',
    'settings.signout.confirm': 'サインアウトしますか？',
    'settings.signout': 'サインアウト',
    'settings.autopost.title': '自動Now Playing投稿（β）',
    'settings.autopost.desc1': 'Last.fm と連携することで、スマートフォン・PC で再生した曲を Bluesky に自動で投稿できます。',
    'settings.autopost.desc2': '対応サービス: Spotify / Amazon Music / Apple Music など Last.fm スクロブル対応アプリ全般',
    'settings.lastfm.label': 'Last.fm ユーザー名',
    'settings.customtext.label': 'カスタムテキスト（任意）',
    'settings.customtext.placeholder': '例: #聴いてる #music',
    'settings.customtext.hint': '投稿本文に追加される1行テキスト。ハッシュタグも使えます。',
    'settings.autopost.toggle': '自動投稿',
    'settings.attachimage.toggle': 'ジャケット画像を添付する',
    'settings.probability.label': '投稿確率（気まぐれモード）',
    'settings.probability.hint': '自動投稿の確率を設定できます。投稿確率が1%以上の時、前回の自動投稿から1時間以上経過してから再生した曲は確率を無視して投稿されます。投稿確率が0%のときはいっさい自動投稿されません(ユーザーのPDSには再生履歴は常に記録されます)。',
    'settings.probability.value': '{{value}}%',
    'settings.save': '保存する',
    'settings.saving': '保存中...',
    'settings.saved': '保存しました',
    'settings.error.network': 'ネットワークエラーが発生しました',
    'settings.error.save': '保存に失敗しました',
    'settings.error.LASTFM_USER_NOT_FOUND': 'Last.fmユーザーが見つかりませんでした。ユーザー名が正しいか確認してください',
    'settings.error.LASTFM_USERNAME_REQUIRED': 'Last.fmユーザー名を入力してください',
    'settings.error.DB_SAVE_FAILED': 'データ保存に失敗しました。しばらく経ってから再試行してください',
    'settings.noauth': 'サインインしていません。',
    'settings.gotologin': 'ログイン画面へ',
    'settings.privacy.title': 'プライバシー',
    'settings.privacy.description': 'おすすめ・リアルタイム・なうぷれライブへの表示を設定します。',
    'settings.privacy.hide.toggle': '自分の再生履歴をフィード・ライブに表示しない',
    'settings.privacy.save': '保存する',
    'settings.privacy.saving': '保存中...',
    'settings.privacy.saved': '保存しました',

    // --- Profile page ---
    'profile.back': 'ホームに戻る',
    'profile.tab.report': 'レポート',
    'profile.tab.playlists': 'プレイリスト',
    'profile.tab.history': '履歴',
    'profile.report.totalplays': '総なうぷれ回数',
    'profile.report.genres': 'ジャンル別再生',
    'profile.report.genres.hint': '全ジャンルを固定順で表示',
    'profile.report.title.label': 'あなたの称号',
    'profile.report.title.two': '{{a}} × {{b}}',
    'profile.report.title.one': '{{a}}',
    'profile.report.title.none': 'なうぷれあったー',
    'profile.report.toptracks': '再生回数トップ5',
    'profile.report.timeline': '時間帯別の再生',
    'profile.report.updating': '更新中…',
    'profile.report.empty': 'まだデータがありません',
    'profile.report.tooltip.hour': '{{hour}}時',
    'profile.report.tooltip.plays': '{{count}}回',
    'profile.playlist.new': '新規プレイリスト作成',
    'profile.playlist.prompt': 'プレイリスト名を入力してください:',
    'profile.playlist.created': 'プレイリストを作成しました！',
    'profile.playlist.createfailed': '作成に失敗しました: ',
    'profile.playlist.empty': '空のプレイリスト',
    'profile.playlist.notfound': 'プレイリストが見つかりません。',
    'profile.playlist.modal.empty': 'プレイリストが見つかりません。',
    'profile.history.empty': '履歴がまだありません。',
    'profile.history.date.unknown': '日時不明',
    'profile.history.delete.confirm': '再生履歴から削除しますか？',
    'profile.history.delete.failed': '再生履歴の削除に失敗しました',
    'profile.mute.button': 'ユーザーミュート',
    'profile.unmute.button': 'ミュート解除',
    'profile.mute.confirm.title': 'ユーザーをミュートしますか？',
    'profile.mute.confirm.body': '{{name}} さんをミュートすると、おすすめ・みんなのなうぷれ・なうぷれライブ・なうぷれミックスに表示されなくなります。',
    'profile.mute.confirm.ok': 'ミュートする',
    'profile.mute.confirm.cancel': 'キャンセル',
    'profile.mute.failed': 'ミュートに失敗しました。',
    'profile.unmute.failed': 'ミュート解除に失敗しました。',
    'profile.bluesky': 'Blueskyのプロフィールを開く',
    'profile.tags.label': 'よく聴いているアーティスト',

    // --- Artist page ---
    'artist.label': 'アーティスト',
    'artist.summary': '{{plays}} 回再生 ・ {{listeners}} 人が聴いています',
    'artist.tracks': 'よく聴かれている曲',
    'artist.listeners': '聴いている人',
    'artist.listeners.empty': '表示できるリスナーがいません。',
    'artist.empty': 'このアーティストのなうぷれはまだ集計されていません。',
    'profile.edit.button': 'プロフィールを編集',
    'profile.edit.title': 'プロフィールを編集',
    'profile.edit.note': 'なうぷれあっとで表示されるプロフィールです。Blueskyのプロフィールは変更されません。',
    'profile.edit.avatar': 'アバター',
    'profile.edit.pick': '画像を選択',
    'profile.edit.pick.hint': '画像を選ぶと、切り抜き位置を調整できます。',
    'profile.edit.change': '別の画像を選択',
    'profile.edit.hint': 'ドラッグで位置、スライダーで大きさを調整できます。',
    'profile.edit.zoom': '大きさ',
    'profile.edit.save': '保存',
    'profile.edit.saving': '保存中…',
    'profile.edit.cancel': 'キャンセル',
    'profile.edit.error.toolarge': 'ファイルサイズが大きすぎます（20MBまで）。',
    'profile.edit.error.decode': 'この画像は読み込めませんでした。別の画像を選んでください。',
    'profile.edit.error.save': 'プロフィールの保存に失敗しました。',
    'profile.edit.error.reauth': 'アバターの保存には再サインインが必要です。設定画面からサインアウトし、もう一度サインインしてください。',

    // --- TrackCard ---
    'track.play': '再生する',
    'track.spotify': 'Spotifyで再生',
    'track.ytmusic': 'YouTube Musicで再生',
    'track.applemusic': 'Apple Musicで再生',
    'track.delete': '削除',
    'track.nowplaying.btn': '再生中にする',
    'track.comment.placeholder': 'コメントを追加...',
    'track.post.bsky': 'Blueskyに投稿',
    'track.add.playlist': 'プレイリストに追加',
    'track.processing': '処理中...',

    // --- PlaylistCard ---
    'playlist.tracks': '{{count}} 曲',

    // --- SetupHelpModal ---
    'setup.modal.title': '自動投稿のセットアップ',
    'setup.modal.step1.title': '1. Last.fmに登録する',
    'setup.modal.step1.desc': 'Last.fmは再生履歴を記録するサービスです。まだ登録していない方はこちらから登録してください。',
    'setup.modal.step1.link': 'Last.fmに登録する →',
    'setup.modal.step1.skip': '設定済みの場合は 2. へ',
    'setup.modal.step2.title': '2. 音楽サービスをLast.fmに連携する',
    'setup.modal.step2.desc': '音楽サービスをLast.fmに連携することで、再生した曲がlast.fmに自動的に記録されます。SpotifyはSpotifyアプリの設定から連携できます。',
    'setup.modal.step2.link': 'Last.fm アプリ連携設定 →',
    'setup.modal.step2.skip': '設定済みの場合は 3. へ',
    'setup.modal.step3.title': '3. なうぷれあっとにユーザー名を登録する',
    'setup.modal.step3.desc': 'このページの「Last.fm ユーザー名」欄にLast.fmのユーザー名を入力して「保存する」をクリックすれば、last.fmの再生履歴をなうぷれあっとが自動で読み込みます！',
    'setup.modal.btn.close': '閉じる',
    'setup.help.btn': 'セットアップ方法',

    // --- InfoModal ---
    'info.title': 'なうぷれあっと について',
    'info.p1': 'なうぷれあっと（以下、本アプリ）は AT protocol の音楽共有サービスです。',
    'info.li1': '自分の再生した曲を検索してシェアしよう！',
    'info.li2': 'オリジナルのプレイリストを作ってシェアしよう！',
    'info.li3': 'ビビッときた曲、プレイリストには絵文字リアクションを送ろう！',
    'info.dev.pre': '本アプリは ',
    'info.dev.post': ' 個人が趣味で開発しています。',
    'info.storage': '再生履歴やプレイリストなどはユーザーのPDSに保存されます。OAuthセッションと自動投稿設定は、機能提供のため運営者が利用するデータベースに保存されます。詳しくはプライバシーポリシーをご確認ください。',
    'info.caveat': '個人開発のため手厚いサポートはできず、突如サービスを終了する可能性があります。ただし、データはユーザーのPDSに置くため、サービスが終了してもデータそのものは消えません。',
    'info.other': 'その他',
    'info.other.desc': 'このページに記載される文章は予告なく変更することがあります。',
    'info.links': 'リンク',

    // --- About page ---
    'about.head.title': 'なうぷれあっと とは | 音楽共有ATprotoサービス',
    'about.head.desc': '聴いている曲を記録して、Blueskyでシェアする。AT Protocol 上の音楽共有サービス「なうぷれあっと」の紹介ページです。',
    'about.hero.label': '#NowPlaying on ATprotocol',
    'about.hero.tagline': '聴いてる音楽が、そのまま人とつながる。',
    'about.hero.sub': 'なうぷれあっとは、AT Protocol の上に立つ音楽共有サービス。いま聴いている曲を記録して、Bluesky の友達とシェアできます。',
    'about.hero.cta.start': 'はじめる',
    'about.hero.cta.explore': 'どんなサービス？',
    'about.hero.scroll': '下にスクロール',

    'about.what.label': 'What is it',
    'about.what.title': 'なうぷれあっと とは',
    'about.what.lead': '聴いた曲を記録して、Blueskyでシェアする。やることはシンプルですが、そこから音楽の話がはじまります。',
    'about.what.1.title': '聴いた曲が、自動で残る',
    'about.what.1.desc': 'Last.fm と連携すれば、スマホやPCで再生した曲がそのまま再生履歴になります。Bluesky への投稿も自動です。',
    'about.what.2.title': 'みんなの「いま」が見える',
    'about.what.2.desc': 'フォロー中のユーザーがいま何を聴いているかが流れてきます。知らなかった一曲に出会えます。',
    'about.what.3.title': '反応して、まとめて、渡す',
    'about.what.3.desc': 'ビビッときた曲には絵文字リアクション。お気に入りはプレイリストにまとめて、そのまま Bluesky にシェアできます。',

    'about.why.label': 'Why',
    'about.why.title': '選ばれる理由',
    'about.why.1.title': 'データはあなたのPDSに',
    'about.why.1.desc': '再生履歴もプレイリストも、保存先はあなた自身の PDS です。サービスが終わってもデータそのものは消えません。',
    'about.why.2.title': '投稿はあなたのペースで',
    'about.why.2.desc': '投稿確率を 0〜100% で調整できる「気まぐれモード」。タイムラインを埋めない距離感で使えます。',
    'about.why.3.title': '音楽サービスをまたいで届く',
    'about.why.3.desc': 'Spotify / Apple Music / YouTube Music のリンクを自動で解決。相手が別のサービスでもそのまま聴けます。',
    'about.why.4.title': '無料・オープンソース',
    'about.why.4.desc': '個人が趣味で開発していて、広告もサブスクもありません。ソースコードは GitHub で公開しています。',

    'about.stats.label': 'Numbers',
    'about.stats.title': 'これまでに聴かれた曲',
    'about.stats.total': '総なうぷれ回数',
    'about.stats.unit': '回',
    'about.stats.daily': '日ごとのなうぷれ回数',
    'about.stats.note': 'なうぷれあっとに記録された再生履歴の総数です。',

    'about.cta.title': 'さっそく、はじめよう',
    'about.cta.desc': 'Bluesky のアカウントがあれば、すぐに使えます。',
    'about.cta.nosignup': 'Bluesky のアカウントをまだ持っていませんか？',
    'about.cta.signup': 'Blueskyでアカウントを作る',
    'about.cta.signup.hint': 'Bluesky のアカウント作成画面が開きます。作成が終わるとそのまま なうぷれあっと に戻ってきます。',
    'about.cta.signedin': '{{name}} さんとしてサインイン済みです。',
    'about.cta.home': 'ホームへ',

    'about.footer.home': '← ホームに戻る',
    'about.footer.dev': '開発: すいばり',

    // --- Main page: about banner (guests) ---
    'about.banner.bold': 'なうぷれあっと ってなに？',
    'about.banner.desc': ' 30秒でわかる紹介ページを用意しました。',
    'about.banner.cta': '見てみる →',
  },
  en: {
    // --- Main page: banner ---
    'banner.bold': 'Auto Now Playing on Bluesky',
    'banner.desc': ' Link Last.fm to auto-post tracks from your phone or PC.',
    'banner.cta': 'Go to Settings →',

    // --- Main page: search ---
    'search.placeholder': 'Search songs, artists, albums...',

    // --- Main page: tabs ---
    'tab.search': 'Find Music',
    'tab.recommend': 'For You',
    'tab.hot': 'Chart',
    'tab.discovery': "Everyone's",
    'everyone.realtime': 'Realtime',
    'recommend.loading': 'Loading recommendations...',
    'recommend.empty': 'No plays from the people you follow yet.',
    'hot.toptracks': 'Tracks',
    'hot.topplaylists': 'Playlists',
    'hot.topusers': 'Users',
    'hot.trending': 'Trending',
    'hot.loadmore': 'Load more',
    'hot.loading': 'Aggregating chart...',
    'hot.empty.tracks': 'No trending tracks yet.',
    'hot.empty.playlists': 'No trending playlists yet.',
    'hot.empty.users': 'No trending users yet.',
    'hot.users.count': '{{count}} plays',
    'discovery.loading': "Loading everyone's now playing...",

    // --- Main page: live users (right pane) ---
    'live.title': 'Now Playing Live',
    'live.empty': 'Nobody is listening right now',

    // --- Main page: mix (right pane) ---
    'mix.title': 'NowPlaying Mix',
    'mix.empty': 'No recommendations found',
    'mix.recommended_by': "'s pick of today",

    // --- Main page: global stats (right pane) ---
    'stats.title': 'Now Playing Stats',
    'stats.total': 'Total NowPlaying',
    'stats.daily': 'NowPlaying per Day',
    'stats.tooltip.plays': '{{count}} plays',

    // --- Legal links ---
    'legal.terms': 'Terms',
    'legal.privacy': 'Privacy',
    'legal.nav': 'Legal information',

    // --- Main page: sign-in modal ---
    'signin.modal.title': 'Sign In',

    // --- Main page: discovery ---
    'discovery.listening': 'is listening to',
    'discovery.reacted': 'reacted with',
    'discovery.playlist': 'created a playlist',
    'discovery.empty': 'No reactions yet. Be the first!',
    'discovery.error': 'Failed to load feed',
    'group.count': '{{count}} tracks',
    'recommend.score': 'Match',
    'recommend.score.tooltip': 'How well this track matches your taste, based on your NowPlayingAt history',

    // --- Main page: playlist modal ---
    'playlist.modal.title': 'Add to Playlist',
    'playlist.modal.empty': 'No playlists found. Create one from your profile!',

    // --- Main page: login ---
    'redirect': 'Redirecting...',
    'signin': 'Sign In',

    // --- Alerts / confirms ---
    'confirm.post': 'Post "{{title}}" to Bluesky?',
    'alert.posted': 'Posted to Bluesky!',
    'alert.history': 'Added to history!',
    'alert.failed': 'Failed: ',
    'alert.signinfailed': 'Sign in failed: ',
    'alert.addedto': 'Added to "{{name}}"!',
    'alert.addfailed': 'Failed to add: ',

    // --- Track count ---
    'tracks.count': '{{count}} tracks',

    // --- Settings page ---
    'settings.back': 'Back to Home',
    'settings.title': 'Settings',
    'settings.language.title': 'Language',
    'settings.language.label': 'Display Language',
    'settings.signout.confirm': 'Sign out?',
    'settings.signout': 'Sign Out',
    'settings.autopost.title': 'Auto Now Playing Post (β)',
    'settings.autopost.desc1': 'Link Last.fm to auto-post tracks played on your phone or PC to Bluesky.',
    'settings.autopost.desc2': 'Supported services: Spotify / Amazon Music / Apple Music and all Last.fm scrobble-compatible apps.',
    'settings.lastfm.label': 'Last.fm Username',
    'settings.customtext.label': 'Custom Text (optional)',
    'settings.customtext.placeholder': 'e.g. #nowplaying #music',
    'settings.customtext.hint': 'One-line text added to posts. Hashtags are supported.',
    'settings.autopost.toggle': 'Auto Post',
    'settings.attachimage.toggle': 'Attach album art',
    'settings.probability.label': 'Post Probability (Capricious Mode)',
    'settings.probability.hint': 'Set the probability for auto-posting. When the probability is 1% or higher, tracks played after one hour or more since the previous auto-post are posted regardless of probability. When the probability is 0%, no auto-posts are made at all (play history is always recorded to the user\'s PDS).',
    'settings.probability.value': '{{value}}%',
    'settings.save': 'Save',
    'settings.saving': 'Saving...',
    'settings.saved': 'Saved',
    'settings.error.network': 'Network error occurred',
    'settings.error.save': 'Failed to save',
    'settings.error.LASTFM_USER_NOT_FOUND': 'Last.fm user not found. Please check your username.',
    'settings.error.LASTFM_USERNAME_REQUIRED': 'Please enter your Last.fm username.',
    'settings.error.DB_SAVE_FAILED': 'Failed to save data. Please try again later.',
    'settings.noauth': 'Not signed in.',
    'settings.gotologin': 'Go to Login',
    'settings.privacy.title': 'Privacy',
    'settings.privacy.description': 'Configure visibility in recommendations, realtime, and live feeds.',
    'settings.privacy.hide.toggle': 'Hide my listening history from feeds and live',
    'settings.privacy.save': 'Save',
    'settings.privacy.saving': 'Saving...',
    'settings.privacy.saved': 'Saved',

    // --- Profile page ---
    'profile.back': 'Back to Home',
    'profile.tab.report': 'Report',
    'profile.tab.playlists': 'Playlists',
    'profile.tab.history': 'History',
    'profile.report.totalplays': 'Total Now Playings',
    'profile.report.genres': 'Plays by Genre',
    'profile.report.genres.hint': 'All genres shown in a fixed order',
    'profile.report.title.label': 'Your Title',
    'profile.report.title.two': '{{a}} × {{b}}',
    'profile.report.title.one': '{{a}}',
    'profile.report.title.none': 'NowPlayingAter',
    'profile.report.toptracks': 'Top 5 Tracks',
    'profile.report.timeline': 'Plays by Hour',
    'profile.report.updating': 'Updating…',
    'profile.report.empty': 'No data yet',
    'profile.report.tooltip.hour': '{{hour}}:00',
    'profile.report.tooltip.plays': '{{count}} plays',
    'profile.playlist.new': 'New Playlist',
    'profile.playlist.prompt': 'Enter playlist name:',
    'profile.playlist.created': 'Playlist created!',
    'profile.playlist.createfailed': 'Failed to create: ',
    'profile.playlist.empty': 'Empty playlist',
    'profile.playlist.notfound': 'No playlists found.',
    'profile.playlist.modal.empty': 'No playlists found.',
    'profile.history.empty': 'No history yet.',
    'profile.history.date.unknown': 'Unknown date',
    'profile.history.delete.confirm': 'Remove from history?',
    'profile.history.delete.failed': 'Failed to delete',
    'profile.mute.button': 'Mute User',
    'profile.unmute.button': 'Unmute',
    'profile.mute.confirm.title': 'Mute this user?',
    'profile.mute.confirm.body': "Muting {{name}} will hide them from Recommend, Everyone's now-playing, Live, and Mix.",
    'profile.mute.confirm.ok': 'Mute',
    'profile.mute.confirm.cancel': 'Cancel',
    'profile.mute.failed': 'Failed to mute user.',
    'profile.unmute.failed': 'Failed to unmute user.',
    'profile.bluesky': 'Open Bluesky profile',
    'profile.tags.label': 'Most played artists',

    // --- Artist page ---
    'artist.label': 'Artist',
    'artist.summary': '{{plays}} plays · {{listeners}} listeners',
    'artist.tracks': 'Most played tracks',
    'artist.listeners': 'Listeners',
    'artist.listeners.empty': 'No listeners to show.',
    'artist.empty': 'No plays have been aggregated for this artist yet.',
    'profile.edit.button': 'Edit profile',
    'profile.edit.title': 'Edit profile',
    'profile.edit.note': 'This profile is shown on NowPlayingAt. Your Bluesky profile is not changed.',
    'profile.edit.avatar': 'Avatar',
    'profile.edit.pick': 'Choose image',
    'profile.edit.pick.hint': 'Pick an image, then adjust how it is cropped.',
    'profile.edit.change': 'Choose another image',
    'profile.edit.hint': 'Drag to reposition, use the slider to resize.',
    'profile.edit.zoom': 'Size',
    'profile.edit.save': 'Save',
    'profile.edit.saving': 'Saving…',
    'profile.edit.cancel': 'Cancel',
    'profile.edit.error.toolarge': 'That file is too large (20MB max).',
    'profile.edit.error.decode': 'That image could not be loaded. Please choose another one.',
    'profile.edit.error.save': 'Failed to save your profile.',
    'profile.edit.error.reauth': 'Saving your avatar needs a fresh sign-in. Please sign out in Settings and sign in again.',

    // --- TrackCard ---
    'track.play': 'Play',
    'track.spotify': 'Play on Spotify',
    'track.ytmusic': 'Play on YouTube Music',
    'track.applemusic': 'Play on Apple Music',
    'track.delete': 'Delete',
    'track.nowplaying.btn': 'Set as Now Playing',
    'track.comment.placeholder': 'Add comment...',
    'track.post.bsky': 'Post to Bluesky',
    'track.add.playlist': 'Add to Playlist',
    'track.processing': 'Processing...',

    // --- PlaylistCard ---
    'playlist.tracks': '{{count}} tracks',

    // --- SetupHelpModal ---
    'setup.modal.title': 'Auto-post Setup',
    'setup.modal.step1.title': '1. Create a Last.fm account',
    'setup.modal.step1.desc': 'Last.fm is a service that tracks your listening history. If you don\'t have an account yet, sign up here.',
    'setup.modal.step1.link': 'Sign up for Last.fm →',
    'setup.modal.step1.skip': 'Already have an account? Skip to 2.',
    'setup.modal.step2.title': '2. Connect your music service to Last.fm',
    'setup.modal.step2.desc': 'Connect your music app to Last.fm so your plays are automatically recorded on Last.fm. Spotify can be connected from within the Spotify app settings.',
    'setup.modal.step2.link': 'Last.fm connected apps →',
    'setup.modal.step2.skip': 'Already connected? Skip to 3.',
    'setup.modal.step3.title': '3. Enter your username in NowPlayingAt',
    'setup.modal.step3.desc': 'Enter your Last.fm username in the "Last.fm Username" field on this page and click "Save" — NowPlayingAt will then automatically pull your Last.fm listening history!',
    'setup.modal.btn.close': 'Close',
    'setup.help.btn': 'Setup Guide',

    // --- InfoModal ---
    'info.title': 'About NowPlayingAt',
    'info.p1': 'NowPlayingAt is a music sharing service built on AT protocol.',
    'info.li1': 'Search and share tracks you\'ve been listening to!',
    'info.li2': 'Create original playlists and share them!',
    'info.li3': 'Send emoji reactions to tracks and playlists you love!',
    'info.dev.pre': '',
    'info.dev.post': ' is developing this as a personal hobby project.',
    'info.storage': 'Listening history, playlists and similar data are stored on your PDS. OAuth sessions and auto-post settings are stored in a database used by the Operator to provide the Service. See the Privacy Policy for details.',
    'info.caveat': 'As a personal project, support may be limited and the service may end without notice. However, since data is stored on your PDS, it won\'t disappear if the service ends.',
    'info.other': 'Other',
    'info.other.desc': 'The text on this page may change without notice.',
    'info.links': 'Links',

    // --- About page ---
    'about.head.title': 'About NowPlayingAt | Music sharing on AT Protocol',
    'about.head.desc': 'Log what you listen to and share it on Bluesky. An introduction to NowPlayingAt, a music sharing service built on AT Protocol.',
    'about.hero.label': '#NowPlaying on ATprotocol',
    'about.hero.tagline': 'The music you play, turned into a conversation.',
    'about.hero.sub': 'NowPlayingAt is a music sharing service built on AT Protocol. Log the track you are playing right now and share it with your friends on Bluesky.',
    'about.hero.cta.start': 'Get started',
    'about.hero.cta.explore': 'What is this?',
    'about.hero.scroll': 'Scroll down',

    'about.what.label': 'What is it',
    'about.what.title': 'What is NowPlayingAt',
    'about.what.lead': 'Log the tracks you play, and share them on Bluesky. It is that simple, and that is where the music talk begins.',
    'about.what.1.title': 'Your plays log themselves',
    'about.what.1.desc': 'Link Last.fm and every track you play on your phone or PC becomes listening history. Posting to Bluesky is automatic too.',
    'about.what.2.title': 'See what everyone is playing',
    'about.what.2.desc': 'Watch what the people you follow are listening to right now, and run into the one track you would never have found.',
    'about.what.3.title': 'React, collect, pass it on',
    'about.what.3.desc': 'Send an emoji reaction to a track that hits. Collect favourites into a playlist and share it straight to Bluesky.',

    'about.why.label': 'Why',
    'about.why.title': 'Why people choose it',
    'about.why.1.title': 'Your data lives on your PDS',
    'about.why.1.desc': 'History and playlists are stored on your own PDS. Even if this service shuts down, the data itself stays with you.',
    'about.why.2.title': 'Post at your own pace',
    'about.why.2.desc': 'A whim mode lets you dial posting probability anywhere from 0 to 100%, so you never flood your timeline.',
    'about.why.3.title': 'Works across music services',
    'about.why.3.desc': 'Spotify, Apple Music and YouTube Music links are resolved automatically, so anyone can play it wherever they listen.',
    'about.why.4.title': 'Free and open source',
    'about.why.4.desc': 'Built by one person as a hobby, with no ads and no subscription. The source code is public on GitHub.',

    'about.stats.label': 'Numbers',
    'about.stats.title': 'Tracks played so far',
    'about.stats.total': 'Total plays',
    'about.stats.unit': 'plays',
    'about.stats.daily': 'Plays per day',
    'about.stats.note': 'The total number of listening records logged on NowPlayingAt.',

    'about.cta.title': 'Start listening together',
    'about.cta.desc': 'If you have a Bluesky account, you can start right away.',
    'about.cta.nosignup': "Don't have a Bluesky account yet?",
    'about.cta.signup': 'Create a Bluesky account',
    'about.cta.signup.hint': "Opens Bluesky's account creation screen. Once you are done you come straight back to NowPlayingAt.",
    'about.cta.signedin': 'You are signed in as {{name}}.',
    'about.cta.home': 'Home',

    'about.footer.home': '← Back to home',
    'about.footer.dev': 'Made by suibari',

    // --- Main page: about banner (guests) ---
    'about.banner.bold': 'New to NowPlayingAt?',
    'about.banner.desc': ' Here is a 30-second tour of what it does.',
    'about.banner.cta': 'Take a look →',
  },
};

function interpolate(template: string, vars?: Record<string, string>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export const t = derived(locale, ($locale) => {
  return (key: string, vars?: Record<string, string>): string => {
    const dict = translations[$locale];
    const raw = dict[key] ?? translations['ja'][key] ?? key;
    return interpolate(raw, vars);
  };
});
