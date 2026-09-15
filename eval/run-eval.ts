/**
 * Offline evaluation harness for heads-notes.
 *
 * Measures template adherence, section completeness, fact-phrase recall,
 * ASR vocabulary normalization accuracy, and stub word error rate on
 * sanitized synthetic fixtures under eval/fixtures/.
 *
 * No private meeting content is committed. Live GPT scoring is optional
 * and only runs when OPENAI_API_KEY is set and --live is passed.
 *
 * Usage:
 *   npm run eval
 *   npm run eval -- --live
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateNormalizationCases,
  expectedTemplateLabels,
  extractTemplateLabels,
  factPhraseRecall,
  precisionRecall,
  scoreSectionCompleteness,
  wordErrorRate,
  type NormalizationCase
} from "../src/lib/evalMetrics";
import { normalizeHeadsVocabulary } from "../src/lib/nameNormalization";
import { HEADS_FORMATTING_TEMPLATE } from "../src/lib/template";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const FIXTURES_DIR = path.join(__dirname, "fixtures");
const RESULTS_PATH = path.join(__dirname, "results.json");

type FixtureMeta = {
  id: string;
  title: string;
  meetingDate: string;
  requiredFacts: string[];
  expectLowCompleteness?: boolean;
  asr?: {
    hypothesisFile: string;
    referenceFile: string;
  };
  notes?: string;
};

type FixtureBundle = {
  dir: string;
  meta: FixtureMeta;
  gold: string;
  transcript?: string;
};

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const round4 = (value: number) => Math.round(value * 10000) / 10000;

const readIfExists = async (filePath: string) => {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
};

const loadFixtures = async (): Promise<FixtureBundle[]> => {
  const entries = await fs.readdir(FIXTURES_DIR, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const bundles: FixtureBundle[] = [];

  for (const name of dirs) {
    const dir = path.join(FIXTURES_DIR, name);
    const metaRaw = await fs.readFile(path.join(dir, "meta.json"), "utf8");
    const meta = JSON.parse(metaRaw) as FixtureMeta;
    const gold = await fs.readFile(path.join(dir, "gold.md"), "utf8");
    const transcript =
      (await readIfExists(path.join(dir, "transcript.txt"))) ??
      (await readIfExists(path.join(dir, "transcript_noisy.txt"))) ??
      undefined;
    bundles.push({ dir, meta, gold, transcript: transcript ?? undefined });
  }

  return bundles;
};

const NORMALIZATION_CASES: NormalizationCase[] = [
  {
    id: "sos-to-soas",
    input: "Please charge printing to the SOS budget.",
    expectContains: ["SOAS"],
    expectNotContains: ["SOS"]
  },
  {
    id: "maze-pages",
    input: "Update the maze pages listing tonight.",
    expectContains: ["maize pages"],
    expectNotContains: ["maze pages"]
  },
  {
    id: "bristol-to-briston",
    input: "Ask bristol about the room hold.",
    expectContains: ["Briston"],
    expectNotContains: ["bristol"]
  },
  {
    id: "alias-mseade",
    input: "mseade will post the agenda.",
    expectContains: ["Miles"],
    expectNotContains: ["mseade"]
  },
  {
    id: "alias-calboyd",
    input: "calboyd owns the treasury draft.",
    expectContains: ["Caleb"],
    expectNotContains: ["calboyd"]
  },
  {
    id: "fuzzy-miles-fullname",
    input: "Miles Seade took attendance.",
    expectContains: ["Miles"],
    expectNotContains: ["Seade"]
  },
  {
    id: "fuzzy-christian",
    input: "Christen Brie confirmed capacity.",
    expectContains: ["Christian"]
  },
  {
    id: "fuzzy-hassan",
    input: "Hassan McQueen will track RSVPs.",
    expectContains: ["Hassan"]
  },
  {
    id: "fuzzy-donovan",
    input: "Donovan Fleurina can announce it.",
    expectContains: ["Donovan"]
  },
  {
    id: "fuzzy-hiram",
    input: "Hiram Williams will confirm AV.",
    expectContains: ["Hiram"]
  }
];

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

const formatWithOpenAI = async (
  transcript: string,
  meetingDate: string
): Promise<string> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for --live eval.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.EVAL_MODEL || "gpt-4.1",
      temperature: 0.2,
      messages: [
        { role: "system", content: HEADS_FORMATTING_TEMPLATE },
        {
          role: "user",
          content: `Meeting Date: ${meetingDate}\n\nTranscript:\n${transcript}`
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI formatting failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content?.trim() ?? "";
  return normalizeHeadsVocabulary(content);
};

const main = async () => {
  const live = process.argv.includes("--live");
  const fixtures = await loadFixtures();
  const holdout = fixtures.filter((f) => !f.meta.expectLowCompleteness);
  const negatives = fixtures.filter((f) => f.meta.expectLowCompleteness);

  const expectedLabels = expectedTemplateLabels();

  const goldRows = holdout.map((fixture) => {
    const completeness = scoreSectionCompleteness(fixture.gold);
    const adherence = precisionRecall(
      extractTemplateLabels(fixture.gold),
      expectedLabels
    );
    const facts = factPhraseRecall(fixture.gold, fixture.meta.requiredFacts);
    return {
      id: fixture.meta.id,
      sectionCompleteness: round4(completeness.score),
      templatePrecision: round4(adherence.precision),
      templateRecall: round4(adherence.recall),
      templateF1: round4(adherence.f1),
      factRecall: round4(facts.recall),
      failedChecks: completeness.checks.filter((c) => !c.passed).map((c) => c.id),
      missedFacts: facts.misses
    };
  });

  const negativeRows = negatives.map((fixture) => {
    const completeness = scoreSectionCompleteness(fixture.gold);
    const adherence = precisionRecall(
      extractTemplateLabels(fixture.gold),
      expectedLabels
    );
    return {
      id: fixture.meta.id,
      sectionCompleteness: round4(completeness.score),
      templateF1: round4(adherence.f1),
      passedChecks: completeness.checks.filter((c) => c.passed).map((c) => c.id),
      failedChecks: completeness.checks.filter((c) => !c.passed).map((c) => c.id)
    };
  });

  const normalization = evaluateNormalizationCases(
    normalizeHeadsVocabulary,
    NORMALIZATION_CASES
  );

  const werRows: {
    id: string;
    wer: number;
    substitutions: number;
    deletions: number;
    insertions: number;
    referenceTokens: number;
  }[] = [];

  for (const fixture of holdout) {
    if (!fixture.meta.asr) continue;
    const hypothesis = await fs.readFile(
      path.join(fixture.dir, fixture.meta.asr.hypothesisFile),
      "utf8"
    );
    const reference = await fs.readFile(
      path.join(fixture.dir, fixture.meta.asr.referenceFile),
      "utf8"
    );
    // Normalize hypothesis the same way production does before WER,
    // so the stub WER reflects residual error after alias cleanup.
    const normalizedHyp = normalizeHeadsVocabulary(hypothesis);
    const wer = wordErrorRate(reference, normalizedHyp);
    werRows.push({
      id: fixture.meta.id,
      wer: round4(wer.wer),
      substitutions: wer.substitutions,
      deletions: wer.deletions,
      insertions: wer.insertions,
      referenceTokens: wer.referenceTokens
    });
  }

  // Also report raw (pre-normalization) WER for the noisy fixture.
  const rawWerRows: typeof werRows = [];
  for (const fixture of holdout) {
    if (!fixture.meta.asr) continue;
    const hypothesis = await fs.readFile(
      path.join(fixture.dir, fixture.meta.asr.hypothesisFile),
      "utf8"
    );
    const reference = await fs.readFile(
      path.join(fixture.dir, fixture.meta.asr.referenceFile),
      "utf8"
    );
    const wer = wordErrorRate(reference, hypothesis);
    rawWerRows.push({
      id: fixture.meta.id,
      wer: round4(wer.wer),
      substitutions: wer.substitutions,
      deletions: wer.deletions,
      insertions: wer.insertions,
      referenceTokens: wer.referenceTokens
    });
  }

  let liveRows:
    | {
        id: string;
        sectionCompleteness: number;
        templatePrecision: number;
        templateRecall: number;
        templateF1: number;
        factRecall: number;
        failedChecks: string[];
        missedFacts: string[];
      }[]
    | null = null;

  if (live) {
    liveRows = [];
    for (const fixture of holdout) {
      if (!fixture.transcript) {
        throw new Error(`Fixture ${fixture.meta.id} missing transcript for --live`);
      }
      const generated = await formatWithOpenAI(
        fixture.transcript,
        fixture.meta.meetingDate
      );
      const completeness = scoreSectionCompleteness(generated);
      const adherence = precisionRecall(
        extractTemplateLabels(generated),
        expectedLabels
      );
      const facts = factPhraseRecall(generated, fixture.meta.requiredFacts);
      liveRows.push({
        id: fixture.meta.id,
        sectionCompleteness: round4(completeness.score),
        templatePrecision: round4(adherence.precision),
        templateRecall: round4(adherence.recall),
        templateF1: round4(adherence.f1),
        factRecall: round4(facts.recall),
        failedChecks: completeness.checks
          .filter((c) => !c.passed)
          .map((c) => c.id),
        missedFacts: facts.misses
      });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: live ? "offline+live" : "offline",
    holdoutSize: holdout.length,
    metrics: {
      goldSectionCompletenessMean: round4(
        mean(goldRows.map((r) => r.sectionCompleteness))
      ),
      goldTemplatePrecisionMean: round4(
        mean(goldRows.map((r) => r.templatePrecision))
      ),
      goldTemplateRecallMean: round4(mean(goldRows.map((r) => r.templateRecall))),
      goldTemplateF1Mean: round4(mean(goldRows.map((r) => r.templateF1))),
      goldFactRecallMean: round4(mean(goldRows.map((r) => r.factRecall))),
      negativeControlCompletenessMean: round4(
        mean(negativeRows.map((r) => r.sectionCompleteness))
      ),
      normalizationAccuracy: round4(normalization.accuracy),
      stubWerAfterNormalizationMean: round4(mean(werRows.map((r) => r.wer))),
      stubWerRawMean: round4(mean(rawWerRows.map((r) => r.wer))),
      ...(liveRows
        ? {
            liveSectionCompletenessMean: round4(
              mean(liveRows.map((r) => r.sectionCompleteness))
            ),
            liveTemplateF1Mean: round4(mean(liveRows.map((r) => r.templateF1))),
            liveFactRecallMean: round4(mean(liveRows.map((r) => r.factRecall)))
          }
        : {})
    },
    gold: goldRows,
    negativeControls: negativeRows,
    normalization: {
      accuracy: round4(normalization.accuracy),
      passed: normalization.passed,
      total: normalization.total,
      failures: normalization.failures
    },
    stubWer: {
      afterNormalization: werRows,
      raw: rawWerRows
    },
    live: liveRows,
    privacy: {
      fixturesAreSynthetic: true,
      privateMeetingContentExcluded: true,
      fixtureRoot: "eval/fixtures/"
    }
  };

  await fs.writeFile(RESULTS_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log("heads-notes eval harness");
  console.log("========================");
  console.log(`Holdout fixtures: ${holdout.length}`);
  console.log(
    `Gold section-completeness (mean): ${pct(summary.metrics.goldSectionCompletenessMean)}`
  );
  console.log(
    `Gold template-adherence F1 (mean): ${pct(summary.metrics.goldTemplateF1Mean)}`
  );
  console.log(`Gold fact-phrase recall (mean): ${pct(summary.metrics.goldFactRecallMean)}`);
  console.log(
    `Negative-control completeness (mean): ${pct(
      summary.metrics.negativeControlCompletenessMean
    )}`
  );
  console.log(
    `Vocabulary normalization accuracy: ${pct(summary.metrics.normalizationAccuracy)} (${normalization.passed}/${normalization.total})`
  );
  console.log(
    `Stub WER raw → after normalization: ${pct(summary.metrics.stubWerRawMean)} → ${pct(
      summary.metrics.stubWerAfterNormalizationMean
    )}`
  );
  if (liveRows) {
    console.log(
      `Live GPT section-completeness (mean): ${pct(
        summary.metrics.liveSectionCompletenessMean ?? 0
      )}`
    );
    console.log(
      `Live GPT template F1 (mean): ${pct(summary.metrics.liveTemplateF1Mean ?? 0)}`
    );
    console.log(
      `Live GPT fact recall (mean): ${pct(summary.metrics.liveFactRecallMean ?? 0)}`
    );
  } else {
    console.log("Live GPT formatting: skipped (pass --live with OPENAI_API_KEY to enable)");
  }
  console.log(`Wrote ${path.relative(ROOT, RESULTS_PATH)}`);

  // Fail CI if gold fixtures regress or normalization breaks.
  const goldOk = goldRows.every(
    (row) =>
      row.sectionCompleteness === 1 &&
      row.templateF1 === 1 &&
      row.factRecall === 1
  );
  const negativeOk = negativeRows.every((row) => row.sectionCompleteness < 0.5);
  const normOk = normalization.accuracy === 1;

  if (!goldOk || !negativeOk || !normOk) {
    console.error("\nEval gate failed:");
    if (!goldOk) console.error("- One or more gold fixtures failed completeness/F1/fact recall");
    if (!negativeOk) console.error("- Negative control scored too high (scorer may be weak)");
    if (!normOk) console.error("- Normalization cases failed:", normalization.failures);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
