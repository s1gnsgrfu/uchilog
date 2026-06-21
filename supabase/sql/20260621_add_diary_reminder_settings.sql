create table if not exists public.diary_reminder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  reminder_time time not null default '21:00',
  timezone text not null default 'Asia/Tokyo',
  last_processed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diary_reminder_settings_timezone_not_blank check (length(btrim(timezone)) > 0)
);

alter table public.diary_reminder_settings enable row level security;

drop policy if exists "Users can view own diary reminder settings" on public.diary_reminder_settings;
drop policy if exists "Users can insert own diary reminder settings" on public.diary_reminder_settings;
drop policy if exists "Users can update own diary reminder settings" on public.diary_reminder_settings;
drop policy if exists "Users can delete own diary reminder settings" on public.diary_reminder_settings;

create policy "Users can view own diary reminder settings"
on public.diary_reminder_settings
for select
to authenticated
using (
  auth.uid() = user_id
);

create policy "Users can insert own diary reminder settings"
on public.diary_reminder_settings
for insert
to authenticated
with check (
  auth.uid() = user_id
);

create policy "Users can update own diary reminder settings"
on public.diary_reminder_settings
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

create policy "Users can delete own diary reminder settings"
on public.diary_reminder_settings
for delete
to authenticated
using (
  auth.uid() = user_id
);
