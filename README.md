# H.E.A.D.S. Core Notes Platform

Private Next.js app for authenticated H.E.A.D.S. Core members to:

- Upload meeting audio
- Auto-transcribe with OpenAI Whisper
- Auto-format with GPT into your official template
- Review in a rich text editor
- Save drafts and publish final notes to a private dashboard
- Export notes as TXT, DOCX, or PDF

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres
- OpenAI API (`whisper-1` + `gpt-4.1`)
- TipTap editor

## 1) Environment setup

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
ALLOWED_CORE_EMAILS=alice@school.edu,bob@school.edu
ALLOWED_EMAIL_DOMAIN=school.edu
```

## 2) Database setup (Supabase SQL editor)

Run `supabase-schema.sql`.

## 3) Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Auth flow

- Users log in at `/login` with Supabase email/password accounts.
- `proxy.ts` protects `/dashboard`.
- API routes enforce authentication/authorization server-side.
- Optional allowlist controls:
  - `ALLOWED_CORE_EMAILS` for specific users
  - `ALLOWED_EMAIL_DOMAIN` for a shared domain

## Upload + AI pipeline

`POST /api/meetings/upload`

1. Accepts audio file (`.mp3`, `.wav`, `.m4a`) via form-data
2. Transcribes with Whisper
3. Formats transcript using GPT with your H.E.A.D.S. template
4. Returns formatted notes + raw transcript for review

### Large file handling (>25MB)

- OpenAI Whisper has a ~25MB upload limit per transcription request.
- This app automatically handles larger files by:
  1. Compressing audio to low-bitrate MP3
  2. Splitting into 15-minute chunks
  3. Transcribing each chunk and merging transcripts
- Server requirement: `ffmpeg` must be installed and available on PATH.

## Draft and publishing flow

- Generated content opens in an editor first.
- Choose **Save Draft** to keep it private for later edits.
- Choose **Publish Notes** when ready for Core distribution.

## Export endpoint

`GET /api/meetings/[id]/export?format=txt|docx|pdf`

- Exports one note in the selected format.
- Uses the same auth and allowlist protections as the dashboard.

## Notes

- The dashboard currently expects a `meeting_notes` table and authenticated users.
- You can tighten access further by allowing only specific domains/emails in Supabase Auth settings.

## Deploy with a private URL

The easiest way to get a normal website link is Vercel.

1. Push this project to a private GitHub repo.
2. Import the repo into Vercel.
3. Add the same environment variables from `.env.local` in Vercel Project Settings.
4. Deploy.
5. Use your Vercel URL (for example `https://heads-notes.vercel.app`) in any browser/search bar.

To keep it private:

- Keep `ALLOWED_CORE_EMAILS` limited to your own email, or
- Set `ALLOWED_EMAIL_DOMAIN` to your own private domain.

Users who are not on your allowlist cannot access protected routes or API actions.
