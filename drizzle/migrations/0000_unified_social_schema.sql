
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text default '',
  is_private boolean not null default false,
  last_seen timestamptz default now(),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1), 'user'), '[^a-zA-Z0-9_]', '', 'g'));
  if length(base) < 3 then base := 'user' || base; end if;
  if exists (select 1 from public.profiles where username = base) then
    base := base || substr(md5(random()::text),1,4);
  end if;
  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, base,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', base),
    new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted',
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);
grant select, insert, update, delete on public.follows to authenticated;
grant all on public.follows to service_role;
alter table public.follows enable row level security;
create policy "follows readable" on public.follows for select to authenticated using (true);
create policy "follow self" on public.follows for insert to authenticated with check (auth.uid() = follower_id and follower_id <> following_id);
create policy "accept requests" on public.follows for update to authenticated using (auth.uid() = following_id);
create policy "unfollow or remove" on public.follows for delete to authenticated using (auth.uid() = follower_id or auth.uid() = following_id);

create or replace function public.set_follow_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select is_private from public.profiles where id = new.following_id) then
    new.status := 'pending';
  else
    new.status := 'accepted';
  end if;
  return new;
end $$;
create trigger follows_status before insert on public.follows for each row execute function public.set_follow_status();

create or replace function public.can_view_user(_viewer uuid, _owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select _viewer = _owner
    or not coalesce((select is_private from public.profiles where id = _owner), false)
    or exists (select 1 from public.follows where follower_id = _viewer and following_id = _owner and status = 'accepted')
$$;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_type text not null default 'image',
  caption text default '',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts visible" on public.posts for select to authenticated using (public.can_view_user(auth.uid(), user_id));
create policy "posts insert own" on public.posts for insert to authenticated with check (auth.uid() = user_id);
create policy "posts update own" on public.posts for update to authenticated using (auth.uid() = user_id);
create policy "posts delete own" on public.posts for delete to authenticated using (auth.uid() = user_id);

create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
grant select, insert, delete on public.likes to authenticated;
grant all on public.likes to service_role;
alter table public.likes enable row level security;
create policy "likes readable" on public.likes for select to authenticated using (true);
create policy "like own" on public.likes for insert to authenticated with check (auth.uid() = user_id);
create policy "unlike own" on public.likes for delete to authenticated using (auth.uid() = user_id);

create table public.saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
grant select, insert, delete on public.saves to authenticated;
grant all on public.saves to service_role;
alter table public.saves enable row level security;
create policy "saves own read" on public.saves for select to authenticated using (auth.uid() = user_id);
create policy "saves own insert" on public.saves for insert to authenticated with check (auth.uid() = user_id);
create policy "saves own delete" on public.saves for delete to authenticated using (auth.uid() = user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.comments to authenticated;
grant all on public.comments to service_role;
alter table public.comments enable row level security;
create policy "comments readable" on public.comments for select to authenticated using (true);
create policy "comment own" on public.comments for insert to authenticated with check (auth.uid() = user_id);
create policy "delete own comment" on public.comments for delete to authenticated using (auth.uid() = user_id);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_type text not null default 'image',
  caption text default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
grant select, insert, delete on public.stories to authenticated;
grant all on public.stories to service_role;
alter table public.stories enable row level security;
create policy "active stories visible" on public.stories for select to authenticated using (expires_at > now() and public.can_view_user(auth.uid(), user_id));
create policy "story insert own" on public.stories for insert to authenticated with check (auth.uid() = user_id);
create policy "story delete own" on public.stories for delete to authenticated using (auth.uid() = user_id);

create table public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
grant select, insert on public.story_views to authenticated;
grant all on public.story_views to service_role;
alter table public.story_views enable row level security;
create policy "view own or owner" on public.story_views for select to authenticated using (
  auth.uid() = viewer_id or exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid()));
create policy "record own view" on public.story_views for insert to authenticated with check (auth.uid() = viewer_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  name text,
  photo_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  archived boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text default '',
  media_url text,
  media_type text,
  file_name text,
  reply_to uuid references public.messages(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  primary key (message_id, user_id, emoji)
);
grant select, insert, update, delete on public.conversations, public.conversation_members, public.messages, public.message_reactions to authenticated;
grant all on public.conversations, public.conversation_members, public.messages, public.message_reactions to service_role;

create or replace function public.is_conv_member(_cid uuid, _uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = _cid and user_id = _uid)
$$;

alter table public.conversations enable row level security;
create policy "members see convo" on public.conversations for select to authenticated using (public.is_conv_member(id, auth.uid()));
create policy "members update convo" on public.conversations for update to authenticated using (public.is_conv_member(id, auth.uid()));

alter table public.conversation_members enable row level security;
create policy "members see members" on public.conversation_members for select to authenticated using (public.is_conv_member(conversation_id, auth.uid()));
create policy "update own membership" on public.conversation_members for update to authenticated using (auth.uid() = user_id);
create policy "add members to group" on public.conversation_members for insert to authenticated with check (
  public.is_conv_member(conversation_id, auth.uid()) and exists (select 1 from public.conversations c where c.id = conversation_id and c.is_group));
create policy "leave convo" on public.conversation_members for delete to authenticated using (auth.uid() = user_id);

alter table public.messages enable row level security;
create policy "members read messages" on public.messages for select to authenticated using (public.is_conv_member(conversation_id, auth.uid()));
create policy "members send" on public.messages for insert to authenticated with check (auth.uid() = sender_id and public.is_conv_member(conversation_id, auth.uid()));
create policy "sender edits" on public.messages for update to authenticated using (auth.uid() = sender_id);

alter table public.message_reactions enable row level security;
create policy "members read reactions" on public.message_reactions for select to authenticated using (
  exists (select 1 from public.messages m where m.id = message_id and public.is_conv_member(m.conversation_id, auth.uid())));
create policy "react own" on public.message_reactions for insert to authenticated with check (auth.uid() = user_id and
  exists (select 1 from public.messages m where m.id = message_id and public.is_conv_member(m.conversation_id, auth.uid())));
create policy "unreact own" on public.message_reactions for delete to authenticated using (auth.uid() = user_id);

create or replace function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  update public.conversation_members set last_read_at = now() where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end $$;
create trigger messages_touch after insert on public.messages for each row execute function public.touch_conversation();

create or replace function public.get_or_create_dm(_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  select c.id into cid from public.conversations c
    join public.conversation_members a on a.conversation_id = c.id and a.user_id = me
    join public.conversation_members b on b.conversation_id = c.id and b.user_id = _other
    where not c.is_group limit 1;
  if cid is not null then return cid; end if;
  insert into public.conversations (is_group, created_by) values (false, me) returning id into cid;
  insert into public.conversation_members (conversation_id, user_id) values (cid, me), (cid, _other);
  return cid;
end $$;

create or replace function public.create_group(_name text, _members uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; me uuid := auth.uid(); m uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  insert into public.conversations (is_group, name, created_by) values (true, _name, me) returning id into cid;
  insert into public.conversation_members (conversation_id, user_id, role) values (cid, me, 'admin');
  foreach m in array _members loop
    if m <> me then insert into public.conversation_members (conversation_id, user_id) values (cid, m) on conflict do nothing; end if;
  end loop;
  return cid;
end $$;

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  icon_url text,
  is_private boolean not null default false,
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  kind text not null default 'text',
  position int not null default 0,
  created_at timestamptz not null default now()
);
create table public.channel_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.communities, public.community_members, public.channels, public.channel_messages to authenticated;
grant all on public.communities, public.community_members, public.channels, public.channel_messages to service_role;

create or replace function public.community_role(_cid uuid, _uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.community_members where community_id = _cid and user_id = _uid
$$;
create or replace function public.is_community_staff(_cid uuid, _uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.community_role(_cid, _uid) in ('owner','admin','moderator'), false)
$$;
create or replace function public.can_see_community(_cid uuid, _uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.communities where id = _cid and not is_private)
    or public.community_role(_cid, _uid) is not null
$$;

alter table public.communities enable row level security;
create policy "see communities" on public.communities for select to authenticated using (public.can_see_community(id, auth.uid()));
create policy "create community" on public.communities for insert to authenticated with check (auth.uid() = owner_id);
create policy "admins update community" on public.communities for update to authenticated using (public.community_role(id, auth.uid()) in ('owner','admin'));
create policy "owner deletes community" on public.communities for delete to authenticated using (auth.uid() = owner_id);

alter table public.community_members enable row level security;
create policy "see members" on public.community_members for select to authenticated using (public.can_see_community(community_id, auth.uid()));
create policy "admins set roles" on public.community_members for update to authenticated using (public.community_role(community_id, auth.uid()) in ('owner','admin'));
create policy "leave or kick" on public.community_members for delete to authenticated using (
  auth.uid() = user_id or (public.is_community_staff(community_id, auth.uid()) and role <> 'owner'));

alter table public.channels enable row level security;
create policy "see channels" on public.channels for select to authenticated using (public.can_see_community(community_id, auth.uid()));
create policy "staff create channels" on public.channels for insert to authenticated with check (public.community_role(community_id, auth.uid()) in ('owner','admin'));
create policy "staff update channels" on public.channels for update to authenticated using (public.community_role(community_id, auth.uid()) in ('owner','admin'));
create policy "staff delete channels" on public.channels for delete to authenticated using (public.community_role(community_id, auth.uid()) in ('owner','admin'));

create or replace function public.channel_community(_ch uuid) returns uuid
language sql stable security definer set search_path = public as $$ select community_id from public.channels where id = _ch $$;
create or replace function public.channel_kind(_ch uuid) returns text
language sql stable security definer set search_path = public as $$ select kind from public.channels where id = _ch $$;

alter table public.channel_messages enable row level security;
create policy "members read channel" on public.channel_messages for select to authenticated using (public.can_see_community(public.channel_community(channel_id), auth.uid()));
create policy "members post" on public.channel_messages for insert to authenticated with check (
  auth.uid() = user_id and public.community_role(public.channel_community(channel_id), auth.uid()) is not null
  and (public.channel_kind(channel_id) = 'text' or public.is_community_staff(public.channel_community(channel_id), auth.uid())));
create policy "own or staff moderate" on public.channel_messages for update to authenticated using (
  auth.uid() = user_id or public.is_community_staff(public.channel_community(channel_id), auth.uid()));

create or replace function public.create_community(_name text, _description text, _is_private boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  insert into public.communities (name, description, is_private, owner_id) values (_name, coalesce(_description,''), _is_private, me) returning id into cid;
  insert into public.community_members (community_id, user_id, role) values (cid, me, 'owner');
  insert into public.channels (community_id, name, kind, position) values (cid, 'announcements', 'announcement', 0), (cid, 'general', 'text', 1);
  return cid;
end $$;

create or replace function public.join_community(_cid uuid, _code text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare c record; me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  if _code is not null then select * into c from public.communities where invite_code = _code;
  else select * into c from public.communities where id = _cid; end if;
  if c.id is null then raise exception 'community not found'; end if;
  if c.is_private and (_code is null or _code <> c.invite_code) then raise exception 'invite required'; end if;
  insert into public.community_members (community_id, user_id) values (c.id, me) on conflict do nothing;
  return c.id;
end $$;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  post_id uuid references public.posts(id) on delete cascade,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "mark own read" on public.notifications for update to authenticated using (auth.uid() = user_id);
create policy "delete own notif" on public.notifications for delete to authenticated using (auth.uid() = user_id);

create or replace function public.notify_like() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id) values (owner, new.user_id, 'like', new.post_id);
  end if; return new;
end $$;
create trigger likes_notify after insert on public.likes for each row execute function public.notify_like();

create or replace function public.notify_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id, body) values (owner, new.user_id, 'comment', new.post_id, left(new.body, 140));
  end if; return new;
end $$;
create trigger comments_notify after insert on public.comments for each row execute function public.notify_comment();

create or replace function public.notify_follow() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, actor_id, type)
  values (new.following_id, new.follower_id, case when new.status = 'pending' then 'follow_request' else 'follow' end);
  return new;
end $$;
create trigger follows_notify after insert on public.follows for each row execute function public.notify_follow();

alter publication supabase_realtime add table public.messages, public.message_reactions, public.channel_messages, public.notifications, public.conversation_members;

create policy "media public read" on storage.objects for select using (bucket_id = 'media');
create policy "media upload own folder" on storage.objects for insert to authenticated with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media delete own" on storage.objects for delete to authenticated using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
