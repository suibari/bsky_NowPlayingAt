import type { Locale } from '$lib/i18n';

export type LegalDocumentKind = 'terms' | 'privacy';

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDocument {
  title: string;
  description: string;
  updatedLabel: string;
  updatedAt: string;
  introduction: string;
  sections: LegalSection[];
}

const termsJa: LegalDocument = {
  title: '利用規約',
  description: '「なうぷれあっと」の利用条件を定める利用規約です。',
  updatedLabel: '制定・最終更新',
  updatedAt: '2026年9月12日',
  introduction:
    'この利用規約（以下「本規約」）は、すいばり（以下「運営者」）が提供する「なうぷれあっと」（以下「本サービス」）の利用条件を定めるものです。本サービスを利用する方（以下「利用者」）は、本規約に同意したうえで本サービスを利用してください。',
  sections: [
    {
      title: '1. 本サービスについて',
      paragraphs: [
        '本サービスは、AT Protocol 上で再生履歴、プレイリスト、リアクションなどを記録・共有し、Bluesky や Last.fm などの外部サービスと連携できる無料の音楽共有サービスです。',
        '本サービスは個人が非営利で運営するオープンソースのサービスであり、機能、提供期間およびサポートの継続を保証するものではありません。',
      ],
    },
    {
      title: '2. アカウントと外部サービス',
      paragraphs: [
        '一部の機能には、AT Protocol に対応するアカウントおよび PDS が必要です。自動投稿機能には Last.fm アカウントが必要です。',
        '利用者は、連携する外部サービスの規約およびプライバシーポリシーにも従うものとします。外部サービスのアカウント、認証情報および連携設定は、利用者自身の責任で管理してください。',
      ],
    },
    {
      title: '3. 投稿とデータの公開',
      paragraphs: [
        '利用者が作成した再生履歴、プレイリスト、リアクションその他のデータは、利用者の PDS に保存され、AT Protocol の仕組みにより第三者から取得・閲覧・集約される場合があります。Bluesky への投稿を選択した場合、その内容は Bluesky 上にも公開されます。',
        '利用者は、自ら送信または公開する内容について必要な権利を有し、法令および第三者の権利を侵害しないことを確認するものとします。利用者のコンテンツに関する権利は利用者に留保されますが、運営者は本サービスの提供に必要な範囲で、そのデータを取得、表示、複製、キャッシュ、集計および送信できます。',
      ],
    },
    {
      title: '4. 禁止事項',
      paragraphs: ['利用者は、本サービスの利用にあたり、次の行為をしてはなりません。'],
      bullets: [
        '法令または公序良俗に違反する行為',
        '他者の著作権、商標権、プライバシー、名誉その他の権利または利益を侵害する行為',
        '他者へのなりすまし、不正アクセス、認証情報の不正利用または虚偽情報の送信',
        '本サービスまたは外部サービスのサーバーやネットワークへ過度な負荷をかけ、運営を妨害する行為',
        '本サービスの不具合を意図的に悪用する行為、または他の利用者に不利益や損害を与える行為',
        'その他、運営者が合理的な理由に基づき不適切と判断する行為',
      ],
    },
    {
      title: '5. 利用の制限',
      paragraphs: [
        '運営者は、利用者が本規約に違反した場合、サービスの安全性または継続性を守るために必要な場合、その他合理的な理由がある場合、事前の通知なく機能の利用を制限し、連携を解除し、または対象データを本サービス上の表示対象から除外することがあります。',
      ],
    },
    {
      title: '6. サービスの変更・中断・終了',
      paragraphs: [
        '運営者は、保守、障害、外部サービスの仕様変更、セキュリティ上の必要その他の事情により、本サービスの全部または一部を変更、中断または終了できます。可能な場合は、本サービス上または運営者の Bluesky アカウントで事前に案内します。',
      ],
    },
    {
      title: '7. 保証と責任',
      paragraphs: [
        '本サービスは現状有姿で提供されます。運営者は、正確性、完全性、特定目的への適合性、継続性、外部サービスとの互換性、データが失われないことなどを保証しません。重要なデータは、利用者自身で確認・管理してください。',
        '運営者が本サービスに関して法的責任を負う場合でも、運営者の故意または重大な過失による場合を除き、その責任は利用者に現実に発生した通常かつ直接の損害に限られます。適用法令により制限が認められない場合、本項はその範囲で適用されません。',
      ],
    },
    {
      title: '8. 利用の終了とデータ',
      paragraphs: [
        '利用者は、設定で自動投稿を停止し、サインアウトすることで本サービスの利用を終了できます。運営者側に保存された設定等の削除を希望する場合は、「10. お問い合わせ」の窓口から連絡してください。',
        'サインアウトまたは本サービスの終了によって、利用者の PDS や Bluesky に保存されたデータが自動的に削除されるわけではありません。これらのデータは、本サービスまたは対応する別のクライアントから利用者自身で管理してください。',
      ],
    },
    {
      title: '9. 規約の変更・準拠法',
      paragraphs: [
        '運営者は、法令の変更、本サービスの変更その他必要に応じて本規約を変更できます。重要な変更は、本ページまたは運営者の Bluesky アカウントで案内します。変更後の規約は、本ページに掲載した時点または案内した施行日から適用されます。',
        '本規約は日本法に準拠します。本サービスに関する紛争は、民事訴訟法その他の法令に従い管轄権を有する日本の裁判所を第一審の管轄裁判所とします。',
      ],
    },
    {
      title: '10. お問い合わせ',
      paragraphs: [
        '本規約または本サービスに関するお問い合わせは、運営者の Bluesky アカウント（@suibari.com）へご連絡ください。',
      ],
    },
  ],
};

const privacyJa: LegalDocument = {
  title: 'プライバシーポリシー',
  description: '「なうぷれあっと」における利用者情報の取扱いについて説明します。',
  updatedLabel: '制定・最終更新',
  updatedAt: '2026年9月12日',
  introduction:
    'すいばり（以下「運営者」）は、「なうぷれあっと」（以下「本サービス」）における利用者に関する情報を、次のとおり取り扱います。',
  sections: [
    {
      title: '1. 取得する情報',
      paragraphs: ['本サービスは、提供する機能に応じて次の情報を取得または処理します。'],
      bullets: [
        'AT Protocol の識別情報・認証情報：DID、ハンドル、プロフィール情報、OAuth セッション（アクセストークン等）',
        '本サービスの設定情報：Last.fm ユーザー名、自動投稿の有効・無効、投稿確率、カスタムテキスト、画像添付設定、フィード表示設定、ミュートした DID など',
        '音楽・交流データ：再生履歴、曲名、アーティスト名、アルバム名、プレイリスト、リアクション、関連する Bluesky 投稿など',
        '公開情報：AT Protocol、Bluesky、利用者の PDS および Last.fm から取得する公開プロフィール、フォロー関係、公開レコード、再生情報など',
        '端末・利用情報：DID を保持する Cookie、言語設定を保持するローカルストレージ、IP アドレス、ユーザーエージェント、アクセス日時、エラーログなど、通信・運用上自動的に送信される情報',
        '検索・リンク解決情報：利用者が入力した検索語、曲名、アーティスト名、アルバム名、楽曲 URL など',
      ],
    },
    {
      title: '2. 利用目的',
      bullets: [
        '本人確認、サインイン状態の維持および AT Protocol の操作',
        '再生履歴、プレイリスト、リアクション、検索、チャート、おすすめ等の機能の提供',
        'Last.fm の再生情報の取得、利用者の設定に基づく履歴記録および Bluesky への自動投稿',
        '利用者設定の保存、ミュートや表示制御の反映',
        '不正利用の防止、障害対応、セキュリティ確保およびサービス改善',
        'お問い合わせへの対応および重要な変更の案内',
        '個人を識別しない形での利用状況の集計・表示',
      ],
    },
    {
      title: '3. 保存場所と公開範囲',
      paragraphs: [
        'OAuth セッションと自動投稿等の設定は、運営者が利用するデータベースに保存されます。サインイン状態を識別する Cookie は利用者のブラウザに保存されます。',
        '再生履歴、プレイリスト、リアクションおよび本サービス用設定の一部は、利用者の PDS に保存されます。これらは AT Protocol 上の公開レコードとして第三者から取得・閲覧・再利用される可能性があります。Bluesky への投稿を有効にした場合、投稿内容も公開されます。',
        '「フィード・ライブに表示しない」設定は、本サービス内の対象表示から除外する機能です。PDS 上のレコードを非公開にしたり、他のサービスによる取得を防いだりする機能ではありません。',
      ],
    },
    {
      title: '4. 外部サービスへの送信・委託',
      paragraphs: [
        '本サービスは、機能提供やインフラ運用のため、次の外部サービスに必要な情報を送信し、または処理を委託します。各サービスでの取扱いには、それぞれのプライバシーポリシーが適用されます。',
      ],
      bullets: [
        'AT Protocol 対応サービス、Bluesky および利用者の PDS：認証、プロフィール取得、レコード保存、投稿、画像保存',
        'Last.fm：ユーザー名の確認、再生情報および楽曲情報の取得',
        'Discogs、Apple iTunes Search API：利用者の検索語に基づく楽曲検索',
        'Songlink/Odesli、Spotify、Apple Music、YouTube Music：楽曲リンクの解決および遷移',
        'MusicBrainz、Cover Art Archive、Deezer、YouTube：楽曲情報およびアートワークの取得',
        'Cloudflare：本サービスの配信、キャッシュ、セキュリティおよび通信ログの処理',
      ],
    },
    {
      title: '5. 第三者提供',
      paragraphs: [
        '運営者は、法令に基づく場合、生命・身体・財産の保護に必要で本人の同意を得ることが困難な場合、または前項に記載したサービス提供上必要な送信・委託を除き、取得した個人データを本人の同意なく第三者に提供しません。',
        '利用者が自ら PDS や Bluesky に公開した情報、および公開設定を前提とする AT Protocol 上のデータは、公開情報として取り扱われます。',
      ],
    },
    {
      title: '6. Cookie・ローカルストレージ',
      paragraphs: [
        '本サービスは、サインイン状態の維持に必須の Cookie（DID、最長30日）と、表示言語を保存するローカルストレージを使用します。現在、広告配信または行動追跡を目的とした Cookie やアクセス解析ツールは使用していません。ブラウザの設定で Cookie 等を無効化できますが、一部機能が利用できなくなる場合があります。',
      ],
    },
    {
      title: '7. 保存期間と削除',
      paragraphs: [
        '運営者側の情報は、各機能の提供、セキュリティ、障害対応または法令上必要な期間保存し、不要となった情報は合理的な方法で削除します。OAuth セッションは、通常、サインアウトまたは認可の取消しに伴い削除されます。自動投稿等の設定は、利用者から削除の依頼を受けるまで残る場合があります。',
        'PDS や Bluesky に保存されたデータは、運営者側の情報とは独立して保持されます。利用者は本サービスの対応機能または他の対応クライアントから管理・削除できます。キャッシュやバックアップには、削除後も一定期間残る場合があります。',
      ],
    },
    {
      title: '8. 安全管理',
      paragraphs: [
        '運営者は、アクセス制御、通信の暗号化、認証情報の適切な管理など、取得した情報の漏えい、滅失または毀損を防ぐために合理的な安全管理措置を講じます。ただし、インターネット上の安全性を完全に保証するものではありません。',
      ],
    },
    {
      title: '9. 開示・訂正・削除等',
      paragraphs: [
        '運営者が保有する利用者本人の情報について、開示、訂正、利用停止または削除を希望する場合は、「11. お問い合わせ」の窓口から連絡してください。本人確認を行ったうえで、法令に従い合理的な期間内に対応します。',
        '公開 PDS レコードなど運営者が管理していない情報については、利用者自身の PDS または対応するサービスでの操作が必要です。',
      ],
    },
    {
      title: '10. ポリシーの変更',
      paragraphs: [
        '運営者は、法令や本サービスの変更に応じて本ポリシーを変更できます。重要な変更は、本ページまたは運営者の Bluesky アカウントで案内します。変更後の内容は、本ページに掲載した時点または案内した施行日から適用されます。',
      ],
    },
    {
      title: '11. お問い合わせ',
      paragraphs: [
        '本ポリシーまたは利用者情報の取扱いに関するお問い合わせは、運営者の Bluesky アカウント（@suibari.com）へご連絡ください。',
      ],
    },
  ],
};

const termsEn: LegalDocument = {
  title: 'Terms of Service',
  description: 'Terms governing your use of NowPlayingAt.',
  updatedLabel: 'Effective and last updated',
  updatedAt: 'September 12, 2026',
  introduction:
    'These Terms of Service (“Terms”) govern your use of NowPlayingAt (the “Service”), provided by suibari (the “Operator”). By using the Service, you agree to these Terms.',
  sections: [
    {
      title: '1. About the Service',
      paragraphs: [
        'The Service is a free music-sharing service that lets users record and share listening history, playlists, reactions and related data on AT Protocol, with integrations such as Bluesky and Last.fm.',
        'The Service is a non-commercial, open-source project operated by an individual. The Operator does not guarantee that any feature, support or the Service itself will remain available.',
      ],
    },
    {
      title: '2. Accounts and third-party services',
      paragraphs: [
        'Some features require an AT Protocol account and PDS. Auto-posting requires a Last.fm account.',
        'You must also comply with the terms and privacy policies of connected services. You are responsible for managing your accounts, credentials and integration settings.',
      ],
    },
    {
      title: '3. Content and visibility',
      paragraphs: [
        'Listening history, playlists, reactions and other data you create are stored on your PDS and may be retrieved, viewed and aggregated by third parties through AT Protocol. Content you choose to post to Bluesky is also public on Bluesky.',
        'You must have the rights necessary to submit or publish your content and must not violate any law or third-party right. You retain your rights in your content, while granting the Operator permission to retrieve, display, copy, cache, aggregate and transmit it only as needed to operate the Service.',
      ],
    },
    {
      title: '4. Prohibited conduct',
      paragraphs: ['You may not:'],
      bullets: [
        'violate laws or public order;',
        'infringe copyrights, trademarks, privacy, reputation or other rights or interests;',
        'impersonate others, gain unauthorized access, misuse credentials or submit false information;',
        'place excessive load on, disrupt or interfere with the Service or any connected network;',
        'intentionally exploit defects or harm other users; or',
        'engage in other conduct the Operator reasonably considers inappropriate.',
      ],
    },
    {
      title: '5. Restrictions',
      paragraphs: [
        'The Operator may restrict access, disconnect an integration or exclude data from display without prior notice when a user violates these Terms, when needed to protect the security or continuity of the Service, or for another reasonable cause.',
      ],
    },
    {
      title: '6. Changes, suspension and termination',
      paragraphs: [
        'The Operator may change, suspend or end all or part of the Service due to maintenance, failures, changes to third-party services, security needs or other circumstances. Where practical, notice will be posted in the Service or on the Operator’s Bluesky account.',
      ],
    },
    {
      title: '7. Warranties and liability',
      paragraphs: [
        'The Service is provided as is. The Operator does not warrant accuracy, completeness, fitness for a particular purpose, continued availability, compatibility with third-party services or freedom from data loss. You are responsible for checking and managing important data.',
        'Where the Operator is legally liable in connection with the Service, liability is limited to direct, ordinary and actual damages, except in cases of intent or gross negligence. This limitation does not apply where prohibited by applicable law.',
      ],
    },
    {
      title: '8. Ending use and your data',
      paragraphs: [
        'You may stop auto-posting in Settings and sign out to end your use of the Service. To request deletion of settings stored by the Operator, contact the channel in Section 10.',
        'Signing out or termination of the Service does not automatically delete data stored on your PDS or Bluesky. Manage that data through the Service or another compatible client.',
      ],
    },
    {
      title: '9. Changes to these Terms and governing law',
      paragraphs: [
        'The Operator may amend these Terms to reflect changes in law or the Service. Material changes will be announced on this page or the Operator’s Bluesky account. Amended Terms apply from publication or the stated effective date.',
        'These Terms are governed by Japanese law. Courts in Japan having jurisdiction under applicable procedural law will be the courts of first instance for disputes relating to the Service.',
      ],
    },
    {
      title: '10. Contact',
      paragraphs: ['For questions about these Terms or the Service, contact the Operator on Bluesky at @suibari.com.'],
    },
  ],
};

const privacyEn: LegalDocument = {
  title: 'Privacy Policy',
  description: 'How NowPlayingAt handles information relating to its users.',
  updatedLabel: 'Effective and last updated',
  updatedAt: 'September 12, 2026',
  introduction:
    'This Privacy Policy explains how suibari (the “Operator”) handles information relating to users of NowPlayingAt (the “Service”).',
  sections: [
    {
      title: '1. Information we process',
      paragraphs: ['Depending on the features you use, the Service collects or processes:'],
      bullets: [
        'AT Protocol identifiers and authentication data: DID, handle, profile information and OAuth session data, including access tokens;',
        'Service settings: Last.fm username, auto-post status, posting probability, custom text, image attachment and feed visibility settings, and muted DIDs;',
        'music and social data: listening history, track, artist and album names, playlists, reactions and related Bluesky posts;',
        'public data obtained from AT Protocol, Bluesky, PDSs and Last.fm, such as public profiles, follows, public records and listening information;',
        'device and usage data: the DID cookie, language preference in local storage, IP address, user agent, access time, error logs and similar information transmitted for network and operational purposes; and',
        'search and link-resolution data: search terms, track, artist and album names, and music URLs.',
      ],
    },
    {
      title: '2. Purposes',
      bullets: [
        'authentication, maintaining sessions and performing AT Protocol operations;',
        'providing history, playlists, reactions, search, charts and recommendations;',
        'retrieving Last.fm listening data and recording history or auto-posting to Bluesky according to your settings;',
        'saving preferences and applying mute or visibility controls;',
        'preventing misuse, troubleshooting, maintaining security and improving the Service;',
        'responding to inquiries and communicating important changes; and',
        'producing and displaying statistics that do not identify individuals.',
      ],
    },
    {
      title: '3. Storage and visibility',
      paragraphs: [
        'OAuth sessions and settings such as auto-post preferences are stored in a database used by the Operator. A session cookie is stored in your browser.',
        'Listening history, playlists, reactions and some Service configuration are stored on your PDS. They may be public AT Protocol records that third parties can retrieve, view and reuse. Content posted to Bluesky is also public.',
        'The “hide from feeds and live” setting removes your data from specified views within this Service. It does not make PDS records private or stop other services from retrieving them.',
      ],
    },
    {
      title: '4. Service providers and external services',
      paragraphs: [
        'To provide features and operate its infrastructure, the Service sends necessary data to, or engages processing by, the following services. Each service’s own privacy policy applies to its processing.',
      ],
      bullets: [
        'AT Protocol services, Bluesky and your PDS: authentication, profile retrieval, record and image storage, and posting;',
        'Last.fm: username verification and retrieval of listening and track information;',
        'Discogs and Apple iTunes Search API: music searches based on your query;',
        'Songlink/Odesli, Spotify, Apple Music and YouTube Music: link resolution and navigation;',
        'MusicBrainz, Cover Art Archive, Deezer and YouTube: track information and artwork; and',
        'Cloudflare: delivery, caching, security and processing of network logs.',
      ],
    },
    {
      title: '5. Disclosure to third parties',
      paragraphs: [
        'The Operator does not disclose personal data without consent, except as required by law, when needed to protect life, safety or property and consent is difficult to obtain, or for the transmissions and processing necessary to provide the Service as described above.',
        'Information you publish to a PDS or Bluesky, and AT Protocol data intended to be public, is treated as public information.',
      ],
    },
    {
      title: '6. Cookies and local storage',
      paragraphs: [
        'The Service uses an essential cookie containing your DID to maintain sign-in for up to 30 days and local storage for your language preference. It currently uses no advertising cookies, cross-site tracking cookies or analytics service. Disabling browser storage may prevent some features from working.',
      ],
    },
    {
      title: '7. Retention and deletion',
      paragraphs: [
        'Operator-held information is kept while necessary to provide features, maintain security, resolve incidents or comply with law, and is deleted using reasonable measures when no longer needed. OAuth sessions are normally deleted when you sign out or revoke authorization. Other settings may remain until you ask the Operator to delete them.',
        'Data on your PDS or Bluesky is retained independently. Manage or delete it using supported features or another compatible client. Cached or backed-up copies may remain for a limited period after deletion.',
      ],
    },
    {
      title: '8. Security',
      paragraphs: [
        'The Operator takes reasonable measures such as access controls, encryption in transit and appropriate credential management to protect information from leakage, loss or damage. No Internet service can guarantee complete security.',
      ],
    },
    {
      title: '9. Access, correction and deletion requests',
      paragraphs: [
        'To request access to, correction, restriction or deletion of your information held by the Operator, use the contact in Section 11. The Operator may verify your identity and will respond within a reasonable time as required by law.',
        'For public PDS records and other information outside the Operator’s control, you must use your PDS or the relevant service.',
      ],
    },
    {
      title: '10. Changes to this Policy',
      paragraphs: [
        'The Operator may amend this Policy to reflect changes in law or the Service. Material changes will be announced on this page or the Operator’s Bluesky account. Changes apply from publication or the stated effective date.',
      ],
    },
    {
      title: '11. Contact',
      paragraphs: ['For privacy questions or requests, contact the Operator on Bluesky at @suibari.com.'],
    },
  ],
};

export const legalDocuments: Record<Locale, Record<LegalDocumentKind, LegalDocument>> = {
  ja: { terms: termsJa, privacy: privacyJa },
  en: { terms: termsEn, privacy: privacyEn },
};
