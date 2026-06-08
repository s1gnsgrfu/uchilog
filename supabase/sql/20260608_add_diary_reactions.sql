create table if not exists public.diary_reactions (
  diary_id uuid not null references public.diaries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null default 'like',
  created_at timestamptz not null default now(),
  primary key (diary_id, user_id, reaction),
  constraint diary_reactions_reaction_check check (reaction = 'like')
);

alter table public.diary_reactions enable row level security;

drop policy if exists "Authenticated users can view visible diary reactions" on public.diary_reactions;

create policy "Authenticated users can view visible diary reactions"
on public.diary_reactions
for select
to authenticated
using (
  exists (
    select 1
    from public.diaries
    where diaries.id = diary_reactions.diary_id
      and (
        diaries.user_id = auth.uid()
        or diaries.is_shared = true
      )
  )
);

drop policy if exists "Users can react to visible diaries" on public.diary_reactions;

create policy "Users can react to visible diaries"
on public.diary_reactions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.diaries
    where diaries.id = diary_reactions.diary_id
      and (
        diaries.user_id = auth.uid()
        or diaries.is_shared = true
      )
  )
);

drop policy if exists "Users can delete own diary reactions" on public.diary_reactions;

create policy "Users can delete own diary reactions"
on public.diary_reactions
for delete
to authenticated
using (
  auth.uid() = user_id
);
