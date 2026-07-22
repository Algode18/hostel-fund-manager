-- ============================================================================
-- Expense Splitter — Supabase schema
-- Run this once in Supabase Studio → SQL Editor (or via `supabase db push`).
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. PROFILES — one row per authenticated user (mirrors auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default 'New User',
  email       text not null,
  avatar_hue  integer not null default floor(random() * 360),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================================
-- 2. GROUPS
-- ============================================================================
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) > 0),
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.groups enable row level security;

-- ============================================================================
-- 3. GROUP MEMBERS — roster + role. user_id is null until an invited
--    person signs up with a matching email (handled by trigger below).
-- ============================================================================
create table if not exists public.group_members (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  name        text not null check (char_length(trim(name)) > 0),
  email       text not null,
  role        text not null default 'member' check (role in ('admin', 'member')),
  avatar_hue  integer not null default floor(random() * 360),
  created_at  timestamptz not null default now(),
  unique (group_id, email)
);

alter table public.group_members enable row level security;
create index if not exists group_members_group_id_idx on public.group_members(group_id);
create index if not exists group_members_user_id_idx on public.group_members(user_id);

-- ---- helper functions (security definer = bypass RLS internally, but only
-- ---- ever check auth.uid(), never trust client input for identity) --------
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(gid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.current_member_id(gid uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.group_members
  where group_id = gid and user_id = auth.uid()
  limit 1;
$$;

-- ---- groups policies --------------------------------------------------
drop policy if exists "groups_select_members" on public.groups;
create policy "groups_select_members"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id));

drop policy if exists "groups_update_admins" on public.groups;
create policy "groups_update_admins"
  on public.groups for update
  to authenticated
  using (public.is_group_admin(id));

-- Note: there is intentionally NO insert policy on groups — creation always
-- goes through create_group_with_members() below, which avoids the
-- chicken-and-egg problem of "you must already be a member to add yourself".

-- ---- group_members policies -------------------------------------------
drop policy if exists "group_members_select_members" on public.group_members;
create policy "group_members_select_members"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "group_members_insert_admins" on public.group_members;
create policy "group_members_insert_admins"
  on public.group_members for insert
  to authenticated
  with check (public.is_group_admin(group_id));

drop policy if exists "group_members_update_admins" on public.group_members;
create policy "group_members_update_admins"
  on public.group_members for update
  to authenticated
  using (public.is_group_admin(group_id));

drop policy if exists "group_members_delete_admins" on public.group_members;
create policy "group_members_delete_admins"
  on public.group_members for delete
  to authenticated
  using (public.is_group_admin(group_id));

-- ============================================================================
-- 4. DEPOSITS
-- ============================================================================
create table if not exists public.deposits (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  member_id   uuid not null references public.group_members(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

alter table public.deposits enable row level security;
create index if not exists deposits_group_id_idx on public.deposits(group_id);

drop policy if exists "deposits_select_members" on public.deposits;
create policy "deposits_select_members"
  on public.deposits for select
  to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "deposits_insert_admins" on public.deposits;
create policy "deposits_insert_admins"
  on public.deposits for insert
  to authenticated
  with check (public.is_group_admin(group_id) and created_by = auth.uid());

drop policy if exists "deposits_delete_admins" on public.deposits;
create policy "deposits_delete_admins"
  on public.deposits for delete
  to authenticated
  using (public.is_group_admin(group_id));

-- ============================================================================
-- 5. EXPENSES + EXPENSE_PARTICIPANTS
--    Direct INSERT is intentionally blocked (no insert policy) — all expense
--    creation goes through create_expense() so the expense row and its
--    participant rows are written atomically and validated together.
-- ============================================================================
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  title       text not null check (char_length(trim(title)) > 0),
  amount      numeric(12,2) not null check (amount > 0),
  paid_by     uuid not null references public.group_members(id),
  created_by  uuid not null references public.group_members(id),
  created_at  timestamptz not null default now()
);

alter table public.expenses enable row level security;
create index if not exists expenses_group_id_idx on public.expenses(group_id);

create table if not exists public.expense_participants (
  expense_id  uuid not null references public.expenses(id) on delete cascade,
  member_id   uuid not null references public.group_members(id) on delete cascade,
  primary key (expense_id, member_id)
);

alter table public.expense_participants enable row level security;

drop policy if exists "expenses_select_members" on public.expenses;
create policy "expenses_select_members"
  on public.expenses for select
  to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "expenses_update_creator_or_admin" on public.expenses;
create policy "expenses_update_creator_or_admin"
  on public.expenses for update
  to authenticated
  using (public.is_group_admin(group_id) or created_by = public.current_member_id(group_id));

drop policy if exists "expenses_delete_creator_or_admin" on public.expenses;
create policy "expenses_delete_creator_or_admin"
  on public.expenses for delete
  to authenticated
  using (public.is_group_admin(group_id) or created_by = public.current_member_id(group_id));

drop policy if exists "expense_participants_select_members" on public.expense_participants;
create policy "expense_participants_select_members"
  on public.expense_participants for select
  to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_participants.expense_id and public.is_group_member(e.group_id)
  ));

-- ============================================================================
-- 6. RPC: create_group_with_members
--    Atomically creates a group, adds the caller as admin, and adds any
--    invited roommates (unclaimed until they sign up with a matching email).
-- ============================================================================
create or replace function public.create_group_with_members(
  p_name text,
  p_members jsonb default '[]'::jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_group_id uuid;
  v_profile  public.profiles%rowtype;
  v_member   jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Group name is required';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found for current user';
  end if;

  insert into public.groups (name, created_by)
  values (trim(p_name), auth.uid())
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, name, email, role, avatar_hue)
  values (v_group_id, auth.uid(), v_profile.name, v_profile.email, 'admin', v_profile.avatar_hue);

  for v_member in select * from jsonb_array_elements(coalesce(p_members, '[]'::jsonb))
  loop
    if trim(coalesce(v_member->>'name', '')) <> '' and trim(coalesce(v_member->>'email', '')) <> '' then
      insert into public.group_members (group_id, name, email, role, avatar_hue)
      values (
        v_group_id,
        trim(v_member->>'name'),
        lower(trim(v_member->>'email')),
        'member',
        floor(random() * 360)::int
      )
      on conflict (group_id, email) do nothing;

      -- auto-link if that person already has an account
      update public.group_members gm
      set user_id = p.id
      from public.profiles p
      where gm.group_id = v_group_id
        and gm.user_id is null
        and lower(gm.email) = lower(p.email);
    end if;
  end loop;

  return v_group_id;
end;
$$;

grant execute on function public.create_group_with_members(text, jsonb) to authenticated;

-- ============================================================================
-- 6b. RPC: add_group_member
--    Adds a roommate to an EXISTING group (admin-only). If that email
--    already belongs to a signed-up user, link them immediately — this is
--    the same auto-link create_group_with_members() does for brand-new
--    groups, but was previously missing when adding to a group after the
--    fact, so already-registered invitees never appeared linked until they
--    happened to sign up fresh.
-- ============================================================================
create or replace function public.add_group_member(
  p_group_id uuid,
  p_name text,
  p_email text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_member_id uuid;
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'Only an admin can add members to this group';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Name is required';
  end if;
  if trim(coalesce(p_email, '')) = '' then
    raise exception 'Email is required';
  end if;

  insert into public.group_members (group_id, name, email, role, avatar_hue)
  values (p_group_id, trim(p_name), lower(trim(p_email)), 'member', floor(random() * 360)::int)
  returning id into v_member_id;

  update public.group_members gm
  set user_id = p.id
  from public.profiles p
  where gm.id = v_member_id
    and gm.user_id is null
    and lower(gm.email) = lower(p.email);

  return v_member_id;
end;
$$;

grant execute on function public.add_group_member(uuid, text, text) to authenticated;

-- ============================================================================
-- 7. RPC: create_expense
--    Atomically creates an expense + its participant rows, validating that
--    the payer and every participant actually belong to the group.
-- ============================================================================
create or replace function public.create_expense(
  p_group_id uuid,
  p_title text,
  p_amount numeric,
  p_paid_by uuid,
  p_participant_ids uuid[]
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_creator_member_id uuid;
  v_expense_id uuid;
  v_pid uuid;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;
  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Title is required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if p_participant_ids is null or array_length(p_participant_ids, 1) is null then
    raise exception 'At least one participant is required';
  end if;

  select id into v_creator_member_id
  from public.group_members
  where group_id = p_group_id and user_id = auth.uid();

  if v_creator_member_id is null then
    raise exception 'Membership record not found';
  end if;

  if not exists (select 1 from public.group_members where id = p_paid_by and group_id = p_group_id) then
    raise exception 'paid_by is not a member of this group';
  end if;

  insert into public.expenses (group_id, title, amount, paid_by, created_by)
  values (p_group_id, trim(p_title), p_amount, p_paid_by, v_creator_member_id)
  returning id into v_expense_id;

  foreach v_pid in array p_participant_ids loop
    if not exists (select 1 from public.group_members where id = v_pid and group_id = p_group_id) then
      raise exception 'participant % is not a member of this group', v_pid;
    end if;
    insert into public.expense_participants (expense_id, member_id) values (v_expense_id, v_pid);
  end loop;

  return v_expense_id;
end;
$$;

grant execute on function public.create_expense(uuid, text, numeric, uuid, uuid[]) to authenticated;

-- ============================================================================
-- 7b. RPC: update_my_name
--    group_members.name is a denormalized copy of profiles.name (needed so
--    invited-but-not-yet-signed-up members can be displayed before they have
--    an account). This keeps both in sync whenever someone edits their name.
-- ============================================================================
create or replace function public.update_my_name(p_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Name is required';
  end if;

  update public.profiles set name = trim(p_name) where id = auth.uid();
  update public.group_members set name = trim(p_name) where user_id = auth.uid();
end;
$$;

grant execute on function public.update_my_name(text) to authenticated;

-- ============================================================================
-- 8. Auto-create a profile (and claim pending invites) on signup
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  update public.group_members
  set user_id = new.id
  where user_id is null
    and lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
