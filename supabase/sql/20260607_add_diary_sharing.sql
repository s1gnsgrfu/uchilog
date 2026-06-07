alter table public.diaries
add column if not exists is_shared boolean not null default false;

drop policy if exists "Users can view own diaries" on public.diaries;

create policy "Users can view own or shared diaries"
on public.diaries
for select
to authenticated
using (
  auth.uid() = user_id
  or is_shared = true
);

drop policy if exists "Users can update own diaries" on public.diaries;

create policy "Users can update own diaries"
on public.diaries
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);
