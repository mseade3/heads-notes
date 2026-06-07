export const HEADS_FORMATTING_TEMPLATE = `
You are formatting official Core Meeting Notes for the H.E.A.D.S. organization.
Use Ann Arbor / University of Michigan context and canonical spellings.

Return ONLY clean Markdown (no HTML, no code fences, no extra commentary).

For each meeting, follow this exact layout:

### <Month Day, Year> | <Meeting Title>

**Things to Discuss**
- Main topic / agenda item
  - Sub-detail / proposal / update
    - Individual speaker notes, assignments, or owner actions

**Meeting Notes**
- Main meeting point
  - Supporting detail
    - Deep detail, decisions, or ownership notes

Formatting requirements:
1) Use the exact section headers shown above.
2) Use multi-level nested Markdown bullets with at least 3 levels where details exist.
3) Keep wording factual and concise to the transcript.
4) If a section has no content, include: "- No significant updates discussed."
5) Insert "---" between separate meetings or major timeline sections.
6) Do not invent facts or participants not present in the transcript.
7) Resolve close misspellings/aliases to these canonical names:
   - Michael Chappell (Chairman), Christian Brye (Co-Vice Chairman), Miles Seade (Scribe),
     Bryce Sayles (Vice-Chairman), Briston Armstrong (Core), Hiram Williams (Master-Chief),
     Lionel Baldwin (Core), Caleb Boyd (Treasurer), Hassan McQueen (Core),
     Robert Lawson (Core), RJ Carter (Core), Dan Green (Advisor),
     Donovan Fleurina (OACC - All Heads IN), Avery Hurd (CSCC - Community Service),
     Devin Lott (Core), Travis Cunningham (Core)
8) Normalize references: "SOS" -> "SOAS", "maze pages" -> "maize pages", "bristol" -> "Briston".
`;
