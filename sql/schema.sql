-- ============================================================
-- お菓子ログ スキーマ v1
-- Supabase の SQL Editor に「全文コピペ」して実行してください。
-- （video-box / people-map / history-db と同じ Sou_Diary プロジェクトに間借りしますが、
--   この snack_ テーブルは他アプリのテーブルと混ざりません）
--
-- 【最重要・プライバシー】
--   このプロジェクトには他の人のアカウント（例：奥様）も居ます。
--   お菓子ログは「自分のデータは自分(user_id = auth.uid())だけ」に隔離します。
--   ＝ 他のアカウントからは岡野さんの記録は一切見えません。
-- ============================================================

create table if not exists public.snack_records (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name             text not null,                    -- お菓子の名前
  amount           text not null default '',         -- 量（一口／半分／1袋／2袋以上 など）
  category         text default '',                  -- カテゴリ（O4: スナック/チョコ/ジュース等）
  ingredients_text text default '',                  -- 原材料表示のテキスト化（Geminiで抽出、写真自体は保存しない）
  warning_text     text default '',                  -- 添加物などについての強めの警告メッセージ（Gemini生成）
  eaten_at         timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index if not exists idx_snack_records_user on public.snack_records (user_id);
create index if not exists idx_snack_records_eaten_at on public.snack_records (eaten_at desc);

-- ============================================================
-- RLS（行レベルセキュリティ）：自分の行だけ読み書きできる
-- ============================================================
alter table public.snack_records enable row level security;

drop policy if exists snack_records_select on public.snack_records;
drop policy if exists snack_records_write  on public.snack_records;

create policy snack_records_select on public.snack_records
  for select to authenticated
  using (user_id = auth.uid());

create policy snack_records_write on public.snack_records
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- GRANT（RLS だけでなく、ロールへの権限付与も必要）
--   ※ これが無いと RLS が通っても "permission denied" になることがある
-- ============================================================
grant select, insert, update, delete on public.snack_records to authenticated;

-- ============================================================
-- 確認用（任意）：実行後にこの2つで確かめられます
-- ============================================================
-- select count(*) from public.snack_records;  -- 0 が返ればテーブルはできています
-- select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema='public' and table_name='snack_records' and grantee='authenticated';
