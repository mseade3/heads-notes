/**
 * Offline evaluation metrics for Core meeting-note quality.
 * Pure functions — no network, no secrets, safe to run in CI.
 */

export type StructuralCheckId =
  | "title_heading"
  | "things_to_discuss_header"
  | "meeting_notes_header"
  | "things_bullets"
  | "notes_bullets"
  | "nested_depth_2"
  | "nested_depth_3"
  | "no_html"
  | "no_code_fences";

export type StructuralCheck = {
  id: StructuralCheckId;
  label: string;
  passed: boolean;
};

export type SectionCompletenessResult = {
  score: number;
  passed: number;
  total: number;
  checks: StructuralCheck[];
};

export type BinaryLabelSet = Set<string>;

export type PrecisionRecallResult = {
  precision: number;
  recall: number;
  f1: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  predicted: string[];
  expected: string[];
};

export type WerResult = {
  wer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceTokens: number;
  hypothesisTokens: number;
};

const REQUIRED_CHECKS: StructuralCheckId[] = [
  "title_heading",
  "things_to_discuss_header",
  "meeting_notes_header",
  "things_bullets",
  "notes_bullets",
  "nested_depth_2",
  "nested_depth_3",
  "no_html",
  "no_code_fences"
];

const extractSection = (markdown: string, header: string) => {
  const pattern = new RegExp(
    `\\*\\*${header}\\*\\*([\\s\\S]*?)(?=\\n\\*\\*[^*]+\\*\\*|\\n---|$)`,
    "i"
  );
  const match = markdown.match(pattern);
  return match?.[1] ?? "";
};

const maxBulletDepth = (section: string) => {
  let max = 0;
  for (const line of section.split("\n")) {
    const match = line.match(/^(\s*)-\s+/);
    if (!match) continue;
    const spaces = match[1].length;
    // Template uses 0 / 2 / 4 spaces for levels 1 / 2 / 3
    const depth = Math.floor(spaces / 2) + 1;
    if (depth > max) max = depth;
  }
  return max;
};

const sectionHasBullet = (section: string) => /^\s*-\s+/m.test(section);

export const scoreSectionCompleteness = (
  markdown: string
): SectionCompletenessResult => {
  const things = extractSection(markdown, "Things to Discuss");
  const notes = extractSection(markdown, "Meeting Notes");
  const thingsDepth = maxBulletDepth(things);
  const notesDepth = maxBulletDepth(notes);
  const maxDepth = Math.max(thingsDepth, notesDepth);

  const checks: StructuralCheck[] = [
    {
      id: "title_heading",
      label: "H3 title with date | meeting name",
      passed: /^###\s+.+\|.+/m.test(markdown)
    },
    {
      id: "things_to_discuss_header",
      label: "Exact **Things to Discuss** header",
      passed: /\*\*Things to Discuss\*\*/.test(markdown)
    },
    {
      id: "meeting_notes_header",
      label: "Exact **Meeting Notes** header",
      passed: /\*\*Meeting Notes\*\*/.test(markdown)
    },
    {
      id: "things_bullets",
      label: "Things to Discuss has at least one bullet",
      passed: sectionHasBullet(things)
    },
    {
      id: "notes_bullets",
      label: "Meeting Notes has at least one bullet",
      passed: sectionHasBullet(notes)
    },
    {
      id: "nested_depth_2",
      label: "At least 2 levels of nested bullets",
      passed: maxDepth >= 2
    },
    {
      id: "nested_depth_3",
      label: "At least 3 levels of nested bullets",
      passed: maxDepth >= 3
    },
    {
      id: "no_html",
      label: "No HTML tags",
      passed: !/<[a-z][\s\S]*?>/i.test(markdown)
    },
    {
      id: "no_code_fences",
      label: "No markdown code fences",
      passed: !/```/.test(markdown)
    }
  ];

  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  return {
    score: total === 0 ? 0 : passed / total,
    passed,
    total,
    checks
  };
};

/** Labels present in a note for template-adherence precision/recall. */
export const extractTemplateLabels = (markdown: string): BinaryLabelSet => {
  const completeness = scoreSectionCompleteness(markdown);
  const labels = new Set<string>();
  for (const check of completeness.checks) {
    if (check.passed) labels.add(check.id);
  }
  return labels;
};

export const expectedTemplateLabels = (): BinaryLabelSet =>
  new Set(REQUIRED_CHECKS);

export const precisionRecall = (
  predicted: BinaryLabelSet,
  expected: BinaryLabelSet
): PrecisionRecallResult => {
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (const label of predicted) {
    if (expected.has(label)) truePositives += 1;
    else falsePositives += 1;
  }
  for (const label of expected) {
    if (!predicted.has(label)) falseNegatives += 1;
  }

  const precision =
    truePositives + falsePositives === 0
      ? 0
      : truePositives / (truePositives + falsePositives);
  const recall =
    truePositives + falseNegatives === 0
      ? 0
      : truePositives / (truePositives + falseNegatives);
  const f1 =
    precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return {
    precision,
    recall,
    f1,
    truePositives,
    falsePositives,
    falseNegatives,
    predicted: [...predicted].sort(),
    expected: [...expected].sort()
  };
};

export const tokenizeWords = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * Classical word error rate via Levenshtein alignment on tokens.
 * WER = (S + D + I) / N_reference
 */
export const wordErrorRate = (
  reference: string,
  hypothesis: string
): WerResult => {
  const ref = tokenizeWords(reference);
  const hyp = tokenizeWords(hypothesis);
  const n = ref.length;
  const m = hyp.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0)
  );
  const ops: ("M" | "S" | "D" | "I")[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => "M")
  );

  for (let i = 0; i <= n; i += 1) {
    dp[i][0] = i;
    ops[i][0] = "D";
  }
  for (let j = 0; j <= m; j += 1) {
    dp[0][j] = j;
    ops[0][j] = "I";
  }
  ops[0][0] = "M";

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      if (ref[i - 1] === hyp[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        ops[i][j] = "M";
      } else {
        const sub = dp[i - 1][j - 1] + 1;
        const del = dp[i - 1][j] + 1;
        const ins = dp[i][j - 1] + 1;
        const best = Math.min(sub, del, ins);
        dp[i][j] = best;
        if (best === sub) ops[i][j] = "S";
        else if (best === del) ops[i][j] = "D";
        else ops[i][j] = "I";
      }
    }
  }

  let i = n;
  let j = m;
  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  while (i > 0 || j > 0) {
    const op = ops[i][j];
    if (op === "M") {
      i -= 1;
      j -= 1;
    } else if (op === "S") {
      substitutions += 1;
      i -= 1;
      j -= 1;
    } else if (op === "D") {
      deletions += 1;
      i -= 1;
    } else {
      insertions += 1;
      j -= 1;
    }
  }

  const wer = n === 0 ? (m === 0 ? 0 : 1) : (substitutions + deletions + insertions) / n;
  return {
    wer,
    substitutions,
    deletions,
    insertions,
    referenceTokens: n,
    hypothesisTokens: m
  };
};

export type FactHitResult = {
  recall: number;
  hits: string[];
  misses: string[];
  total: number;
};

/** Case-insensitive substring recall of required factual phrases. */
export const factPhraseRecall = (
  markdown: string,
  requiredPhrases: string[]
): FactHitResult => {
  const lower = markdown.toLowerCase();
  const hits: string[] = [];
  const misses: string[] = [];
  for (const phrase of requiredPhrases) {
    if (lower.includes(phrase.toLowerCase())) hits.push(phrase);
    else misses.push(phrase);
  }
  const total = requiredPhrases.length;
  return {
    recall: total === 0 ? 1 : hits.length / total,
    hits,
    misses,
    total
  };
};

export type NormalizationCase = {
  id: string;
  input: string;
  expectContains: string[];
  expectNotContains?: string[];
};

export type NormalizationEvalResult = {
  accuracy: number;
  passed: number;
  total: number;
  failures: { id: string; reason: string }[];
};

export const evaluateNormalizationCases = (
  normalize: (value: string) => string,
  cases: NormalizationCase[]
): NormalizationEvalResult => {
  const failures: { id: string; reason: string }[] = [];
  let passed = 0;

  for (const testCase of cases) {
    const output = normalize(testCase.input);
    const missing = testCase.expectContains.filter(
      (token) => !output.includes(token)
    );
    const leaked = (testCase.expectNotContains ?? []).filter((token) =>
      output.includes(token)
    );
    if (missing.length || leaked.length) {
      failures.push({
        id: testCase.id,
        reason: [
          missing.length ? `missing: ${missing.join(", ")}` : "",
          leaked.length ? `leaked: ${leaked.join(", ")}` : ""
        ]
          .filter(Boolean)
          .join("; ")
      });
    } else {
      passed += 1;
    }
  }

  const total = cases.length;
  return {
    accuracy: total === 0 ? 1 : passed / total,
    passed,
    total,
    failures
  };
};
