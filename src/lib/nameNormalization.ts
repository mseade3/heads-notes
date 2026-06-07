type ReplacementRule = {
  pattern: RegExp;
  replacement: string;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const makeWholeWordRule = (term: string, replacement: string): ReplacementRule => ({
  pattern: new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi"),
  replacement
});

const PERSON_ALIAS_RULES: ReplacementRule[] = [
  makeWholeWordRule("mikeac", "Michael"),
  makeWholeWordRule("cbrye", "Christian"),
  makeWholeWordRule("mseade", "Miles"),
  makeWholeWordRule("bsayles", "Bryce"),
  makeWholeWordRule("briston", "Briston"),
  makeWholeWordRule("hiramw", "Hiram"),
  makeWholeWordRule("lionelb", "Lionel"),
  makeWholeWordRule("calboyd", "Caleb"),
  makeWholeWordRule("hassanmc", "Hassan"),
  makeWholeWordRule("lawsonwr", "Robert"),
  makeWholeWordRule("rjcarter", "RJ"),
  makeWholeWordRule("danhg", "Dan"),
  makeWholeWordRule("averyhur", "Avery"),
  makeWholeWordRule("ldevin", "Devin"),
  makeWholeWordRule("travic", "Travis"),
  makeWholeWordRule("bristol", "Briston"),
  makeWholeWordRule("fleurina", "Donovan")
];

// Conservative ASR/phonetic corrections for known roster names.
// We intentionally match mostly full-name patterns to avoid over-correction.
const PERSON_FUZZY_RULES: ReplacementRule[] = [
  { pattern: /\bmichae?l?\s+chap+p?e?l+l?\b/gi, replacement: "Michael" },
  { pattern: /\bchrist(?:ian|en)\s+b(?:r|ry|rie|ree)e?\b/gi, replacement: "Christian" },
  { pattern: /\bmiles\s+s(?:ea|ee|ei)de\b/gi, replacement: "Miles" },
  { pattern: /\bbryce\s+s(?:a|ai|ay)l(?:e|i)?s\b/gi, replacement: "Bryce" },
  {
    pattern: /\bbr(?:i|y)?st(?:o|i)n\s+armstrong\b|\bbristol\s+armstrong\b/gi,
    replacement: "Briston"
  },
  { pattern: /\bhir(?:a|e)?m\s+williams\b/gi, replacement: "Hiram" },
  { pattern: /\blionel\s+baldw(?:i|y)n\b/gi, replacement: "Lionel" },
  { pattern: /\bcaleb\s+b(?:o|ou)?yd\b/gi, replacement: "Caleb" },
  { pattern: /\bhas+s?a?n\s+mc\s*q(?:ue|we)e+n\b/gi, replacement: "Hassan" },
  { pattern: /\brob(?:ert)?\s+lawson\b/gi, replacement: "Robert" },
  { pattern: /\br\.?\s?j\.?\s+carter\b|\barjay\s+carter\b/gi, replacement: "RJ" },
  { pattern: /\bdan\s+green\b/gi, replacement: "Dan" },
  { pattern: /\bavery\s+h(?:u|er)rd\b/gi, replacement: "Avery" },
  { pattern: /\bdevin\s+lott\b/gi, replacement: "Devin" },
  { pattern: /\btravis\s+cunn?ingham\b/gi, replacement: "Travis" },
  { pattern: /\bdonovan\s+f(?:l|r)eur?i?na\b/gi, replacement: "Donovan" }
];

const TERM_RULES: ReplacementRule[] = [
  makeWholeWordRule("SOS", "SOAS"),
  makeWholeWordRule("maze pages", "maize pages"),
  { pattern: /\bmaze\s+page(?:s)?\b/gi, replacement: "maize pages" }
];

const ALL_RULES: ReplacementRule[] = [
  ...PERSON_ALIAS_RULES,
  ...PERSON_FUZZY_RULES,
  ...TERM_RULES
];

export const normalizeHeadsVocabulary = (value: string) => {
  return ALL_RULES.reduce(
    (nextValue, rule) => nextValue.replace(rule.pattern, rule.replacement),
    value
  );
};
