// Finds the t("…") and tn("…", "…", n) messages in the source and checks each language's catalog.
//   node scripts/i18n.js check   fails on a missing, empty, stale or mismatched translation
//   node scripts/i18n.js sync    adds missing messages to every catalog, empty, for translating
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_LOCALE, LOCALES } from "../src/i18n/translate.js";

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES_DIR = path.join(APP, "src", "i18n", "locales");
const TRANSLATED = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

const STRING = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|` + "`[^`$\\\\]*`";
// t(…) and i18n.t(…), but not obj.t(…) or split(…).
const CALLEE = String.raw`(?:(?<![\w.$])|(?<=\bi18n\.))`;
const T_CALL = new RegExp(String.raw`${CALLEE}t\(\s*(${STRING})`, "g");
const TN_CALL = new RegExp(String.raw`${CALLEE}tn\(\s*(${STRING})\s*,\s*(${STRING})`, "g");

const unquote = (literal) => {
  if (literal.startsWith("`")) return literal.slice(1, -1);
  const body = literal.slice(1, -1).replaceAll(literal[0] === "'" ? "\\'" : '\\"', literal[0]);
  return JSON.parse(`"${body.replaceAll('"', '\\"')}"`);
};

/** Message to its plural (`null` for a singular-only message), from one file's text. */
export const extractMessages = (text) => {
  const found = new Map();
  for (const [, singular, plural] of text.matchAll(TN_CALL)) {
    found.set(unquote(singular), unquote(plural));
  }
  for (const [, message] of text.matchAll(T_CALL)) {
    if (!found.has(unquote(message))) found.set(unquote(message), null);
  }
  return found;
};

const placeholders = (text) =>
  [...text.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join();

/** What is wrong with each catalog, as lines to print. */
export const catalogProblems = (messages, catalogs) => {
  const lines = [];
  for (const [locale, catalog] of Object.entries(catalogs)) {
    for (const [message, plural] of messages) {
      const value = catalog[message];
      const forms = [].concat(value ?? []);
      if (!forms.length || forms.some((f) => !f)) {
        lines.push(`${locale}: untranslated "${message}"`);
      } else if (plural !== null && forms.length !== 2) {
        lines.push(`${locale}: "${message}" needs two forms, one and other`);
      } else if (forms.some((f) => placeholders(f) !== placeholders(message))) {
        lines.push(`${locale}: "${message}" has different {placeholders}`);
      }
    }
    for (const message of Object.keys(catalog)) {
      if (!messages.has(message)) lines.push(`${locale}: stale "${message}"`);
    }
  }
  return lines;
};

const sourceFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(tsx?|js)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [file] : [];
  });

const collect = () => {
  const messages = new Map();
  const files = [...sourceFiles(path.join(APP, "src")), ...sourceFiles(path.join(APP, "scripts"))];
  for (const file of files.filter((f) => !f.endsWith("i18n.js") && !f.endsWith("translate.js"))) {
    for (const [message, plural] of extractMessages(fs.readFileSync(file, "utf8"))) {
      messages.set(message, plural);
    }
  }
  return messages;
};

const catalogFile = (locale) => path.join(LOCALES_DIR, `${locale}.json`);
const readCatalog = (locale) =>
  fs.existsSync(catalogFile(locale))
    ? JSON.parse(fs.readFileSync(catalogFile(locale), "utf8"))
    : {};

const main = (command) => {
  const messages = collect();
  const catalogs = Object.fromEntries(TRANSLATED.map((l) => [l, readCatalog(l)]));
  if (command === "sync") {
    for (const locale of TRANSLATED) {
      for (const [message, plural] of messages) {
        catalogs[locale][message] ??= plural === null ? "" : ["", ""];
      }
      const sorted = Object.fromEntries(
        Object.entries(catalogs[locale]).sort(([a], [b]) => a.localeCompare(b)),
      );
      fs.mkdirSync(LOCALES_DIR, { recursive: true });
      fs.writeFileSync(catalogFile(locale), JSON.stringify(sorted, null, 2) + "\n");
      execFileSync("npx", ["prettier", "--write", catalogFile(locale)], {
        cwd: APP,
        stdio: "ignore",
      });
    }
    console.log(`i18n: ${messages.size} messages in ${TRANSLATED.join(", ")}`);
    return 0;
  }
  const lines = catalogProblems(messages, catalogs);
  lines.forEach((line) => console.error(line));
  console.log(
    lines.length
      ? `i18n: ${lines.length} problems`
      : `i18n: ${messages.size} messages, all translated`,
  );
  return lines.length ? 1 : 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.exitCode = main(process.argv[2] ?? "check");
