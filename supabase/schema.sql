-- Supabase 建表与权限脚本
-- 在 Supabase Dashboard → SQL Editor 中全选执行。

-- 1. 模板表
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  cover_url text default '',
  profile_config jsonb not null,
  sort int not null default 0,
  active bool not null default true,
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at 自动更新
create or replace function public.set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_templates_updated_at on public.templates;
create trigger trg_templates_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

-- 2. RLS
alter table public.templates enable row level security;

drop policy if exists "templates_select_public" on public.templates;
create policy "templates_select_public"
  on public.templates for select
  using (true);

-- 写策略：本人拥有 + 必须是 admin（user_metadata.is_admin = true）
drop policy if exists "templates_write_owner" on public.templates;
create policy "templates_write_owner"
  on public.templates for all
  to authenticated
  using (
    auth.uid() = owner_id
    and coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
  )
  with check (
    auth.uid() = owner_id
    and coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
  );

-- 3. Storage：模板封面 bucket（公开读）
insert into storage.buckets (id, name, public)
values ('template-covers', 'template-covers', true)
on conflict (id) do nothing;

-- Storage 访问策略：所有人可读；仅登录管理员可增删改
drop policy if exists "template_covers_read" on storage.objects;
create policy "template_covers_read"
  on storage.objects for select
  using (bucket_id = 'template-covers');

drop policy if exists "template_covers_insert" on storage.objects;
create policy "template_covers_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'template-covers'
    and coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
  );

drop policy if exists "template_covers_update" on storage.objects;
create policy "template_covers_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'template-covers'
    and coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
  );

drop policy if exists "template_covers_delete" on storage.objects;
create policy "template_covers_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'template-covers'
    and coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
  );

-- 4. 把自己设为 admin（把下面的邮箱换成你的登录邮箱）
-- update auth.users
-- set user_metadata = jsonb_set(coalesce(user_metadata, '{}'::jsonb), '{is_admin}', 'true'::jsonb)
-- where email = 'your@email.com';

-- ============================================================
-- 【补丁】如果上面已经执行过，只需执行下面这一段补建 bucket：
-- ============================================================
-- insert into storage.buckets (id, name, public)
-- values ('template-covers', 'template-covers', true)
-- on conflict (id) do nothing;
--
-- drop policy if exists "template_covers_read" on storage.objects;
-- create policy "template_covers_read" on storage.objects for select
--   using (bucket_id = 'template-covers');
-- drop policy if exists "template_covers_insert" on storage.objects;
-- create policy "template_covers_insert" on storage.objects for insert
--   to authenticated with check (bucket_id = 'template-covers' and coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
-- drop policy if exists "template_covers_update" on storage.objects;
-- create policy "template_covers_update" on storage.objects for update
--   to authenticated using (bucket_id = 'template-covers' and coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
-- drop policy if exists "template_covers_delete" on storage.objects;
-- create policy "template_covers_delete" on storage.objects for delete
--   to authenticated using (bucket_id = 'template-covers' and coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
