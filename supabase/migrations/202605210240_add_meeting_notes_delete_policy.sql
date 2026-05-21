drop policy if exists "core members can delete own draft notes" on public.meeting_notes;

create policy "core members can delete own draft notes"
on public.meeting_notes
for delete
using (auth.uid() = created_by and status = 'draft');
