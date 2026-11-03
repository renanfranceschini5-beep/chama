-- Chama · esquema do banco (Supabase / Postgres)
-- Rode este arquivo inteiro uma vez no SQL Editor do projeto.

create extension if not exists pgcrypto;

-- ---------- Tabelas ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  color text not null default '#7C93FF',
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  leader uuid not null references public.profiles(id) on delete cascade,
  mode text not null default 'mes' check (mode in ('mes', 'dias')),
  days int check (days is null or days between 3 and 90),
  code text not null unique,
  started_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  effective_from date, -- primeiro dia em que a pessoa conta no placar (início da próxima temporada se entrou no meio)
  primary key (group_id, user_id)
);

create table if not exists public.group_metas (
  group_id uuid not null references public.groups(id) on delete cascade,
  season_key text not null,
  value int not null check (value > 0),
  primary key (group_id, season_key)
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  category text not null,
  minutes int not null check (minutes between 1 and 600),
  description text not null default '',
  photo_path text,
  created_at timestamptz not null default now()
);
create index if not exists checkins_user_date on public.checkins (user_id, date);

create table if not exists public.checkin_groups (
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (checkin_id, group_id)
);

create table if not exists public.reactions (
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('🔥', '👏', '💪', '😮', '😂')),
  primary key (checkin_id, user_id, emoji)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('agua', 'sono', 'comida', 'outra')),
  target_num numeric,
  target_text text,
  schedule text not null default 'todos' check (schedule in ('todos', 'uteis')),
  created_at timestamptz not null default now()
);

create table if not exists public.goal_logs (
  goal_id uuid not null references public.goals(id) on delete cascade,
  date date not null,
  value numeric,
  done boolean,
  primary key (goal_id, date)
);

create table if not exists public.calls (
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user, date)
);

-- ---------- Funções auxiliares ----------
create or replace function public.is_member(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = g and user_id = auth.uid());
$$;

create or replace function public.shares_group(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select other = auth.uid() or exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- Perfil criado automaticamente no primeiro login
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name) values (new.id, '') on conflict do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Criar turma (quem cria vira líder e membro)
create or replace function public.create_group(p_name text, p_mode text, p_days int, p_meta int, p_season_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare g uuid; c text;
begin
  loop
    c := 'CHM-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from groups where code = c);
  end loop;
  insert into groups (name, leader, mode, days, code) values (p_name, auth.uid(), p_mode, p_days, c) returning id into g;
  insert into group_members (group_id, user_id) values (g, auth.uid());
  if p_meta is not null and p_season_key is not null then
    insert into group_metas (group_id, season_key, value) values (g, p_season_key, p_meta);
  end if;
  return g;
end; $$;

-- Entrar com código. p_effective_from: o app manda o início da próxima temporada se a atual já começou.
create or replace function public.join_group(p_code text, p_effective_from date)
returns uuid language plpgsql security definer set search_path = public as $$
declare g groups%rowtype;
begin
  select * into g from groups where code = upper(trim(p_code));
  if not found then raise exception 'codigo_invalido'; end if;
  insert into group_members (group_id, user_id, effective_from)
    values (g.id, auth.uid(), case when g.started_at is null then null else p_effective_from end)
    on conflict do nothing;
  return g.id;
end; $$;

-- Ver nome da turma antes de entrar (tela do convite)
create or replace function public.group_by_code(p_code text)
returns table (id uuid, name text, members int, started_at date, mode text, days int) language sql stable security definer set search_path = public as $$
  select g.id, g.name, (select count(*)::int from group_members m where m.group_id = g.id), g.started_at, g.mode, g.days
  from groups g where g.code = upper(trim(p_code));
$$;

-- ---------- Segurança (RLS) ----------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_metas enable row level security;
alter table public.checkins enable row level security;
alter table public.checkin_groups enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.goals enable row level security;
alter table public.goal_logs enable row level security;
alter table public.calls enable row level security;

drop policy if exists p_profiles_sel on public.profiles;
create policy p_profiles_sel on public.profiles for select using (public.shares_group(id));
drop policy if exists p_profiles_upd on public.profiles;
create policy p_profiles_upd on public.profiles for update using (id = auth.uid());

drop policy if exists p_groups_sel on public.groups;
create policy p_groups_sel on public.groups for select using (public.is_member(id));
drop policy if exists p_groups_upd on public.groups;
create policy p_groups_upd on public.groups for update using (leader = auth.uid());

drop policy if exists p_members_sel on public.group_members;
create policy p_members_sel on public.group_members for select using (public.is_member(group_id));
drop policy if exists p_members_del on public.group_members;
create policy p_members_del on public.group_members for delete using (user_id = auth.uid());

drop policy if exists p_metas_sel on public.group_metas;
create policy p_metas_sel on public.group_metas for select using (public.is_member(group_id));
drop policy if exists p_metas_ins on public.group_metas;
create policy p_metas_ins on public.group_metas for insert with check (exists (select 1 from public.groups g where g.id = group_id and g.leader = auth.uid()));
drop policy if exists p_metas_upd on public.group_metas;
create policy p_metas_upd on public.group_metas for update using (exists (select 1 from public.groups g where g.id = group_id and g.leader = auth.uid()));

drop policy if exists p_ck_sel on public.checkins;
create policy p_ck_sel on public.checkins for select using (public.shares_group(user_id));
drop policy if exists p_ck_ins on public.checkins;
create policy p_ck_ins on public.checkins for insert with check (user_id = auth.uid() and date >= current_date - 2 and date <= current_date + 1);
drop policy if exists p_ck_del on public.checkins;
create policy p_ck_del on public.checkins for delete using (user_id = auth.uid());

drop policy if exists p_ckg_sel on public.checkin_groups;
create policy p_ckg_sel on public.checkin_groups for select using (public.is_member(group_id));
drop policy if exists p_ckg_ins on public.checkin_groups;
create policy p_ckg_ins on public.checkin_groups for insert with check (public.is_member(group_id) and exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));

drop policy if exists p_re_sel on public.reactions;
create policy p_re_sel on public.reactions for select using (exists (select 1 from public.checkins c where c.id = checkin_id and public.shares_group(c.user_id)));
drop policy if exists p_re_ins on public.reactions;
create policy p_re_ins on public.reactions for insert with check (user_id = auth.uid());
drop policy if exists p_re_del on public.reactions;
create policy p_re_del on public.reactions for delete using (user_id = auth.uid());

drop policy if exists p_co_sel on public.comments;
create policy p_co_sel on public.comments for select using (exists (select 1 from public.checkins c where c.id = checkin_id and public.shares_group(c.user_id)));
drop policy if exists p_co_ins on public.comments;
create policy p_co_ins on public.comments for insert with check (user_id = auth.uid());
drop policy if exists p_co_del on public.comments;
create policy p_co_del on public.comments for delete using (user_id = auth.uid());

drop policy if exists p_goals_sel on public.goals;
create policy p_goals_sel on public.goals for select using (public.shares_group(user_id));
drop policy if exists p_goals_all on public.goals;
create policy p_goals_all on public.goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists p_gl_sel on public.goal_logs;
create policy p_gl_sel on public.goal_logs for select using (exists (select 1 from public.goals g where g.id = goal_id and public.shares_group(g.user_id)));
drop policy if exists p_gl_all on public.goal_logs;
create policy p_gl_all on public.goal_logs for all using (exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid())) with check (exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid()));

drop policy if exists p_calls_sel on public.calls;
create policy p_calls_sel on public.calls for select using (from_user = auth.uid() or to_user = auth.uid());
drop policy if exists p_calls_ins on public.calls;
create policy p_calls_ins on public.calls for insert with check (from_user = auth.uid() and public.shares_group(to_user));

-- ---------- Fotos ----------
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true) on conflict (id) do nothing;
drop policy if exists p_fotos_ins on storage.objects;
create policy p_fotos_ins on storage.objects for insert to authenticated with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists p_fotos_del on storage.objects;
create policy p_fotos_del on storage.objects for delete to authenticated using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists p_fotos_sel on storage.objects;
create policy p_fotos_sel on storage.objects for select to authenticated using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Acesso da API (as regras RLS acima continuam valendo) ----------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
