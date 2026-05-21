drop policy if exists "core members can delete own draft notes" on public.meeting_notes;
drop policy if exists "core members can delete draft notes" on public.meeting_notes;
drop policy if exists "core members can delete notes" on public.meeting_notes;

create policy "core members can delete notes"
on public.meeting_notes
for delete
using (auth.role() = 'authenticated');
