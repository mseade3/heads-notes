# H.E.A.D.S. Core Notes Platform

Next.js app that turns Core meeting audio into structured board notes:

1. Authenticated upload (Supabase allowlist)
2. Whisper transcription (with ffmpeg chunking for large files)
3. GPT formatting into the official Core Markdown template
4. TipTap review → draft / publish → TXT / DOCX / PDF export

This repository is useful as an **applied speech + LLM pipeline** demo. Offline evaluation under `eval/` reports section-completeness, template-adherence precision/recall, vocabulary-normalization accuracy, and stub WER on **synthetic fixtures only** (no private meetings in git).

## Architecture

```text
┌────────────┐   multipart audio    ┌──────────────────────────┐
│  Dashboard │ ───────────────────► │ POST /api/meetings/upload│
│  (TipTap)  │                      └────────────┬─────────────┘
└─────▲──────┘                                   │
      │                                          ▼
      │                              ┌───────────────────────┐
      │                              │ Size ≤ 25MB?          │
      │                              └───────────┬───────────┘
      │                     yes ─────────────────┴─────────── no
      │                      │                                 │
      │                      ▼                                 ▼
      │              Whisper (single)              ffmpeg compress
      │                                              + 15-min chunks
      │                                              + parallel Whisper
      │                      │                                 │
      │                      └──────────────┬──────────────────┘
      │                                     ▼
      │                      normalizeHeadsVocabulary()
      │                                     │
      │                                     ▼
      │                      GPT-4.1 + HEADS template
      │                                     │
      │                                     ▼
      │                      normalizeHeadsVocabulary()
      │                                     │
      │                     formatted Markdown + raw transcript
      │                                     │
      └──────── review / reformat / save ───┘
                                         │
                                         ▼
                              Supabase `meeting_notes`
                                         │
                                         ▼
                         GET .../export?format=txt|docx|pdf
```

Offline eval path (no secrets required):

```text
eval/fixtures/*  →  src/lib/evalMetrics.ts  →  npm run eval  →  eval/results.json
```

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS + TipTap |
| Auth / DB | Supabase Auth + Postgres |
| Speech | OpenAI `whisper-1` (+ local `ffmpeg` for >25MB) |
| Notes LLM | OpenAI `gpt-4.1` |
| Export | `docx`, `pdf-lib` |
| Eval | Pure TypeScript metrics + synthetic holdout fixtures |

## Evaluation (DS signal)

Private Core recordings stay out of git. The public holdout set lives in `eval/fixtures/` and is fully synthetic.

| Metric | What it measures | Offline result (committed) |
|--------|------------------|----------------------------|
| **Section completeness** | Required headers, bullets, ≥3 nesting levels, no HTML/fences | **100%** mean on gold fixtures |
| **Template-adherence P/R/F1** | Precision/recall over structural labels vs the official template checklist | **P=1.00 / R=1.00 / F1=1.00** on gold |
| **Fact-phrase recall** | Required roster/topic phrases from `meta.json` appear in notes | **100%** mean on gold |
| **Negative-control completeness** | Broken notes must score low (scorer sanity check) | **11.1%** (fails loud) |
| **Vocabulary normalization accuracy** | ASR aliases → canonical first names / SOAS / maize pages | **100%** (10/10 cases) |
| **Stub WER** | Token WER of noisy ASR text vs clean reference, before/after normalization | **29.7% → 12.9%** on fixture `002` |

Re-run locally (no API key):

```bash
npm run eval
```

Optional live GPT formatting score (needs `OPENAI_API_KEY`, spends tokens):

```bash
npm run eval:live
```

Interpretation:

- Offline metrics validate the **scorer**, **gold template**, and **deterministic normalization** layer.
- `--live` scores the actual GPT formatter on the same holdout transcripts (section completeness / template F1 / fact recall).
- Stub WER is text-level (noisy transcript vs clean transcript), not Whisper-on-audio WER. It shows residual ASR-style error after production alias cleanup.

Latest machine-readable summary: [`eval/results.json`](./eval/results.json).

## Run locally (no secrets in git)

```bash
cp .env.example .env.local
# fill Supabase + OpenAI values locally
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Required env vars (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- optional `ALLOWED_CORE_EMAILS` / `ALLOWED_EMAIL_DOMAIN`

Database: run `supabase-schema.sql` in the Supabase SQL editor.

Large audio (>25MB): install `ffmpeg` on PATH so the server can compress/chunk before Whisper.

## Auth flow

- `/login` — Supabase email/password
- `proxy.ts` protects `/dashboard`
- API routes re-check auth + allowlists server-side

## Upload + AI pipeline

`POST /api/meetings/upload`

1. Accepts `.mp3` / `.wav` / `.m4a` (or a precomputed transcript)
2. Transcribes with Whisper (chunked if needed)
3. Formats with GPT using `src/lib/template.ts`
4. Returns formatted notes + raw transcript for review

## Draft / publish / export

- **Save Draft** keeps notes private for later edits
- **Publish Notes** marks them ready for Core distribution
- `GET /api/meetings/[id]/export?format=txt|docx|pdf`

## Privacy

- Do **not** commit real meeting audio or notes
- `.gitignore` blocks `meetings/`, `recordings/`, `private/`, and common audio extensions
- Public eval fixtures are labeled synthetic under `eval/fixtures/`

## Deploy

1. Push to GitHub
2. Import into Vercel
3. Set the same env vars from `.env.local`
4. Deploy

Keep the app private by limiting `ALLOWED_CORE_EMAILS` / `ALLOWED_EMAIL_DOMAIN`.
