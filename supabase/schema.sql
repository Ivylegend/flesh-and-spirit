create table if not exists public.fs_users (
  id text primary key,
  username text not null unique,
  display_name text not null,
  role text not null check (role in ('account', 'guest')),
  password_hash text,
  created_at timestamptz not null default now()
);

create index if not exists fs_users_username_idx on public.fs_users (username);

create table if not exists public.fs_sessions (
  id text primary key,
  token text not null unique,
  user_id text not null references public.fs_users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists fs_sessions_token_idx on public.fs_sessions (token);
create index if not exists fs_sessions_user_id_idx on public.fs_sessions (user_id);

create table if not exists public.fs_rooms (
  id text primary key,
  code text not null unique,
  name text not null,
  visibility text not null check (visibility in ('public', 'private')),
  owner_id text not null references public.fs_users (id) on delete cascade,
  umpire_id text references public.fs_users (id) on delete set null,
  game_status text not null default 'lobby' check (game_status in ('lobby', 'playing', 'won')),
  game_state jsonb,
  game_deck jsonb not null default '[]'::jsonb,
  game_discard jsonb not null default '[]'::jsonb,
  winner_id text,
  leaderboard_awarded boolean not null default false,
  members jsonb not null default '[]'::jsonb,
  token_selections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fs_rooms_visibility_created_at_idx on public.fs_rooms (visibility, created_at desc);
create index if not exists fs_rooms_game_status_idx on public.fs_rooms (game_status);

create table if not exists public.fs_leaderboard_entries (
  user_id text primary key references public.fs_users (id) on delete cascade,
  username text not null,
  display_name text not null,
  role text not null check (role in ('account', 'guest')),
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists fs_leaderboard_wins_idx on public.fs_leaderboard_entries (wins desc, updated_at asc);

create table if not exists public.fs_invitations (
  id text primary key,
  token text not null unique,
  room_id text not null references public.fs_rooms (id) on delete cascade,
  created_by_user_id text not null references public.fs_users (id) on delete cascade,
  invitee_user_id text references public.fs_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists fs_invitations_token_idx on public.fs_invitations (token);
create index if not exists fs_invitations_room_id_idx on public.fs_invitations (room_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fs_rooms'
  ) then
    alter publication supabase_realtime add table public.fs_rooms;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fs_invitations'
  ) then
    alter publication supabase_realtime add table public.fs_invitations;
  end if;
end $$;
