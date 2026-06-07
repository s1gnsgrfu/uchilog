create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can view own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;

create policy "Users can view own push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (
  auth.uid() = user_id
);

create policy "Users can insert own push subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check (
  auth.uid() = user_id
);

create policy "Users can update own push subscriptions"
on public.push_subscriptions
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

create policy "Users can delete own push subscriptions"
on public.push_subscriptions
for delete
to authenticated
using (
  auth.uid() = user_id
);
