create table if not exists public.diary_comments (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diaries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diary_comments_body_not_blank check (length(btrim(body)) > 0),
  constraint diary_comments_body_length check (char_length(body) <= 1000)
);

create index if not exists diary_comments_diary_id_created_at_idx
on public.diary_comments (diary_id, created_at);

alter table public.diary_comments enable row level security;

drop policy if exists "Authenticated users can view visible diary comments" on public.diary_comments;

create policy "Authenticated users can view visible diary comments"
on public.diary_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.diaries
    where diaries.id = diary_comments.diary_id
      and (
        diaries.user_id = auth.uid()
        or diaries.is_shared = true
      )
  )
);

drop policy if exists "Users can comment on visible diaries" on public.diary_comments;

create policy "Users can comment on visible diaries"
on public.diary_comments
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.diaries
    where diaries.id = diary_comments.diary_id
      and (
        diaries.user_id = auth.uid()
        or diaries.is_shared = true
      )
  )
);

drop policy if exists "Users can delete own diary comments" on public.diary_comments;

create policy "Users can delete own diary comments"
on public.diary_comments
for delete
to authenticated
using (
  auth.uid() = user_id
);
