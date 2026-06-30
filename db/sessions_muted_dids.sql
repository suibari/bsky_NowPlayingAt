-- 閲覧者ごとのミュート一覧（プロフィールページのミュートボタンから操作）。
-- ミュートは一方向・閲覧者単位（全体ブロックではない）。sessions は全認証ユーザーに
-- 必ず1行存在する（oauth/callback の upsertSession 'ignore' により保証）ため、
-- 別テーブルを作らずここに配列カラムとして持たせる。
--
-- Run this ONCE against the Postgres behind PostgREST (schema `nowplayingat`).

alter table nowplayingat.sessions
  add column if not exists muted_dids text[] not null default '{}';

-- PostgREST caches the schema; reload so the new column is exposed immediately:
notify pgrst, 'reload schema';
