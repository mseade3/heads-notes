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
  makeWholeWordRule("mikeac", "Michael Chappell"),
  makeWholeWordRule("cbrye", "Christian Brye"),
  makeWholeWordRule("mseade", "Miles Seade"),
  makeWholeWordRule("bsayles", "Bryce Sayles"),
  makeWholeWordRule("briston", "Briston Armstrong"),
  makeWholeWordRule("hiramw", "Hiram Williams"),
  makeWholeWordRule("lionelb", "Lionel Baldwin"),
  makeWholeWordRule("calboyd", "Caleb Boyd"),
  makeWholeWordRule("hassanmc", "Hassan McQueen"),
  makeWholeWordRule("lawsonwr", "Robert Lawson"),
  makeWholeWordRule("rjcarter", "RJ Carter"),
  makeWholeWordRule("danhg", "Dan Green"),
  makeWholeWordRule("averyhur", "Avery Hurd"),
  makeWholeWordRule("ldevin", "Devin Lott"),
  makeWholeWordRule("travic", "Travis Cunningham"),
  makeWholeWordRule("bristol", "Briston"),
  makeWholeWordRule("fleurina", "Donovan Fleurina")
];

// Conservative ASR/phonetic corrections for known roster names.
// We intentionally match mostly full-name patterns to avoid over-correction.
const PERSON_FUZZY_RULES: ReplacementRule[] = [
  { pattern: /\bmichae?l?\s+chap+p?e?l+l?\b/gi, replacement: "Michael Chappell" },
  { pattern: /\bchrist(?:ian|en)\s+b(?:r|ry|rie|ree)e?\b/gi, replacement: "Christian Brye" },
  { pattern: /\bmiles\s+s(?:ea|ee|ei)de\b/gi, replacement: "Miles Seade" },
  { pattern: /\bbryce\s+s(?:a|ai|ay)l(?:e|i)?s\b/gi, replacement: "Bryce Sayles" },
  {
    pattern: /\bbr(?:i|y)?st(?:o|i)n\s+armstrong\b|\bbristol\s+armstrong\b/gi,
    replacement: "Briston Armstrong"
  },
  { pattern: /\bhir(?:a|e)?m\s+williams\b/gi, replacement: "Hiram Williams" },
  { pattern: /\blionel\s+baldw(?:i|y)n\b/gi, replacement: "Lionel Baldwin" },
  { pattern: /\bcaleb\s+b(?:o|ou)?yd\b/gi, replacement: "Caleb Boyd" },
  { pattern: /\bhas+s?a?n\s+mc\s*q(?:ue|we)e+n\b/gi, replacement: "Hassan McQueen" },
  { pattern: /\brob(?:ert)?\s+lawson\b/gi, replacement: "Robert Lawson" },
  { pattern: /\br\.?\s?j\.?\s+carter\b|\barjay\s+carter\b/gi, replacement: "RJ Carter" },
  { pattern: /\bdan\s+green\b/gi, replacement: "Dan Green" },
  { pattern: /\bavery\s+h(?:u|er)rd\b/gi, replacement: "Avery Hurd" },
  { pattern: /\bdevin\s+lott\b/gi, replacement: "Devin Lott" },
  { pattern: /\btravis\s+cunn?ingham\b/gi, replacement: "Travis Cunningham" },
  { pattern: /\bdonovan\s+f(?:l|r)eur?i?na\b/gi, replacement: "Donovan Fleurina" }
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
