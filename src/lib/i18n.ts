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
    'tab.hot': 'なうぷれチャート',
    'tab.discovery': 'みんなのなうぷれ',
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

    // --- Main page: discovery ---
    'discovery.listening': 'が聴いています',
    'discovery.reacted': 'がリアクションしました',
    'discovery.playlist': 'がプレイリストを作成しました',
    'discovery.empty': 'まだリアクションがありません。一番乗りしましょう！',

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
    'settings.probability.hint': '自動投稿の確率を設定できます。ただし前回の自動投稿からしばらく経過した場合は必ず投稿されます。',
    'settings.probability.value': '{{value}}%',
    'settings.save': '保存する',
    'settings.saving': '保存中...',
    'settings.saved': '保存しました',
    'settings.error.network': 'ネットワークエラーが発生しました',
    'settings.error.save': '保存に失敗しました',
    'settings.noauth': 'サインインしていません。',
    'settings.gotologin': 'ログイン画面へ',

    // --- Profile page ---
    'profile.back': 'ホームに戻る',
    'profile.tab.playlists': 'プレイリスト',
    'profile.tab.history': '履歴',
    'profile.playlist.new': '新規プレイリスト作成',
    'profile.playlist.prompt': 'プレイリスト名を入力してください:',
    'profile.playlist.created': 'プレイリストを作成しました！',
    'profile.playlist.createfailed': '作成に失敗しました: ',
    'profile.playlist.empty': '空のプレイリスト',
    'profile.playlist.notfound': 'プレイリストが見つかりません。',
    'profile.playlist.modal.empty': 'プレイリストが見つかりません。',
    'profile.history.empty': '履歴がまだありません。',
    'profile.history.delete.confirm': '再生履歴から削除しますか？',
    'profile.history.delete.failed': '再生履歴の削除に失敗しました',

    // --- TrackCard ---
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

    // --- InfoModal ---
    'info.title': 'なうぷれあっと について',
    'info.p1': 'なうぷれあっと（以下、本アプリ）は AT protocol の音楽共有サービスです。',
    'info.li1': '自分の再生した曲を検索してシェアしよう！',
    'info.li2': 'オリジナルのプレイリストを作ってシェアしよう！',
    'info.li3': 'ビビッときた曲、プレイリストには絵文字リアクションを送ろう！',
    'info.dev.pre': '本アプリは ',
    'info.dev.post': ' 個人が趣味で開発しています。',
    'info.storage': '本アプリは専用のサーバーは持たず、認証情報はユーザーの端末に保存され、データはユーザーのPDSに保存されます。',
    'info.caveat': '個人開発のため手厚いサポートはできず、突如サービスを終了する可能性があります。ただし、データはユーザーのPDSに置くため、サービスが終了してもデータそのものは消えません。',
    'info.other': 'その他',
    'info.other.desc': 'このページに記載される文章は予告なく変更することがあります。',
    'info.links': 'リンク',
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
    'tab.hot': 'Chart',
    'tab.discovery': "Everyone's",
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

    // --- Main page: discovery ---
    'discovery.listening': 'is listening to',
    'discovery.reacted': 'reacted with',
    'discovery.playlist': 'created a playlist',
    'discovery.empty': 'No reactions yet. Be the first!',

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
    'settings.probability.hint': 'Set the probability for auto-posting. However, if some time has passed since the last auto-post, it will always post.',
    'settings.probability.value': '{{value}}%',
    'settings.save': 'Save',
    'settings.saving': 'Saving...',
    'settings.saved': 'Saved',
    'settings.error.network': 'Network error occurred',
    'settings.error.save': 'Failed to save',
    'settings.noauth': 'Not signed in.',
    'settings.gotologin': 'Go to Login',

    // --- Profile page ---
    'profile.back': 'Back to Home',
    'profile.tab.playlists': 'Playlists',
    'profile.tab.history': 'History',
    'profile.playlist.new': 'New Playlist',
    'profile.playlist.prompt': 'Enter playlist name:',
    'profile.playlist.created': 'Playlist created!',
    'profile.playlist.createfailed': 'Failed to create: ',
    'profile.playlist.empty': 'Empty playlist',
    'profile.playlist.notfound': 'No playlists found.',
    'profile.playlist.modal.empty': 'No playlists found.',
    'profile.history.empty': 'No history yet.',
    'profile.history.delete.confirm': 'Remove from history?',
    'profile.history.delete.failed': 'Failed to delete',

    // --- TrackCard ---
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

    // --- InfoModal ---
    'info.title': 'About なうぷれあっと',
    'info.p1': 'なうぷれあっと is a music sharing service built on AT protocol.',
    'info.li1': 'Search and share tracks you\'ve been listening to!',
    'info.li2': 'Create original playlists and share them!',
    'info.li3': 'Send emoji reactions to tracks and playlists you love!',
    'info.dev.pre': '',
    'info.dev.post': ' is developing this as a personal hobby project.',
    'info.storage': 'This app has no dedicated server. Authentication is stored on your device and data is stored on your PDS.',
    'info.caveat': 'As a personal project, support may be limited and the service may end without notice. However, since data is stored on your PDS, it won\'t disappear if the service ends.',
    'info.other': 'Other',
    'info.other.desc': 'The text on this page may change without notice.',
    'info.links': 'Links',
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
