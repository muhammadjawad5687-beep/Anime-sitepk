-- Run this in Supabase Dashboard -> SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.anime (
  id uuid primary key,
  title text not null,
  description text not null default '',
  genres text[] not null default '{}',
  year text not null default '',
  status text not null default 'Ongoing',
  poster text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.episodes (
  id uuid primary key,
  anime_id uuid not null references public.anime(id) on delete cascade,
  number integer not null,
  title text not null,
  video text not null,
  created_at timestamptz not null default now()
);

create index if not exists episodes_anime_id_idx on public.episodes(anime_id);

-- Storage bucket used by the Node server. The service-role key is kept server-side.
insert into storage.buckets (id,name,public,file_size_limit)
values ('anime-media','anime-media',true,52428800)
on conflict (id) do update set public=true, file_size_limit=52428800;

-- Public read access for posters/videos. Upload/delete are performed by the server with service role.
drop policy if exists "Public read anime media" on storage.objects;
create policy "Public read anime media"
on storage.objects for select
using (bucket_id = 'anime-media');

-- Optional: prevent direct client-side writes. The Node server creates signed upload URLs.
drop policy if exists "No public upload anime media" on storage.objects;
