# heads-notes eval fixtures
#
# All meetings under this tree are **synthetic**. They exist so the public
# repo can demonstrate offline metrics without committing private Core notes.
#
# Do not add real transcripts, names beyond the public roster aliases already
# used in `src/lib/nameNormalization.ts`, or sensitive org details.

## Layout

Each fixture directory contains:

- `meta.json` — id, meeting date, required fact phrases, optional ASR paths
- `gold.md` — human gold notes in the official Core template
- `transcript.txt` **or** `transcript_noisy.txt` + `transcript_clean.txt`

## Privacy

Private meeting audio and notes stay out of git. Local-only paths such as
`meetings/`, `recordings/`, and `private/` are gitignored if you create them.
