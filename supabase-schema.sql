create table if not exists public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  meeting_date date not null,
  title text not null,
  content text not null,
  raw_transcript text,
  created_by uuid not null references auth.users(id),
  status text not null default 'draft' check (status in ('draft', 'published'))
);

alter table public.meeting_notes
add column if not exists status text not null default 'draft';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'meeting_notes_status_check'
  ) then
    alter table public.meeting_notes
      add constraint meeting_notes_status_check
      check (status in ('draft', 'published'));
  end if;
end;
$$;

alter table public.meeting_notes enable row level security;

create policy "core members can read notes"
on public.meeting_notes
for select
using (auth.role() = 'authenticated');

create policy "core members can insert own notes"
on public.meeting_notes
for insert
with check (auth.uid() = created_by);

create policy "core members can update own notes"
on public.meeting_notes
for update
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

drop policy if exists "core members can delete own draft notes" on public.meeting_notes;
drop policy if exists "core members can delete draft notes" on public.meeting_notes;
drop policy if exists "core members can delete notes" on public.meeting_notes;
create policy "core members can delete notes"
on public.meeting_notes
for delete
using (auth.role() = 'authenticated');
