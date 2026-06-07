drop policy if exists "Users can delete own diaries" on public.diaries;

create policy "Users can delete own diaries"
on public.diaries
for delete
to authenticated
using (
  auth.uid() = user_id
);
