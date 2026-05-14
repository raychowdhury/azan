import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(root, 'src');
const catalogs = ['en', 'ar'].map(locale => ({
  locale,
  path: join(srcDir, 'i18n', `${locale}.json`),
  data: JSON.parse(readFileSync(join(srcDir, 'i18n', `${locale}.json`), 'utf8')),
}));

const baseKeys = Object.keys(catalogs[0].data).sort();
let failed = false;

for (const catalog of catalogs.slice(1)) {
  const keys = Object.keys(catalog.data).sort();
  const missing = baseKeys.filter(key => !keys.includes(key));
  const extra = keys.filter(key => !baseKeys.includes(key));

  if (missing.length || extra.length) {
    failed = true;
    console.error(`i18n key mismatch for ${catalog.locale}`);
    if (missing.length) console.error(`  Missing: ${missing.join(', ')}`);
    if (extra.length) console.error(`  Extra: ${extra.join(', ')}`);
  }
}

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path);
    return path.endsWith('.jsx') ? [path] : [];
  });
}

const allowedText = new Set([
  'N',
  'E',
  'S',
  'W',
  '✕',
  '−',
  '+',
  '›',
  '🕌',
  '🕋',
  '☽',
  '──◈──',
  '── ✦ ──',
  'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  'أوقات الصلاة',
  'Aladhan API',
  'islamcan.com',
  'archive.org (Public Domain)',
  // Brand + onboarding copy — translated by design language, not user-facing config.
  'Azan',
  'Locating prayer times…',
  'Private by default',
  'Reminders fire locally. No tracking, no account, no servers.',
  // Mosque submission form — Phase 3 feature, gated on Supabase env. Hidden
  // until verified-DB enabled. TODO: i18n when feature ships to all users.
  'Submit a mosque',
  'Thank you. Your submission is queued for review.',
  'Close',
  'Cancel',
  'Mosque name *',
  'Address',
  'Latitude *',
  'Longitude *',
  'Phone',
  'Website',
  'Iqamah times',
  "Jumu'ah time",
  'Notes (languages, facilities, parking…)',
  'Your contact (optional)',
  'Email or phone for follow-up',
]);

const textNodePattern = />[ \t]*([^<>{}\n][^<>{}\n]*)[ \t]*</g;
const attrPattern = /\b(title|aria-label|placeholder)="([^"]*[A-Za-z][^"]*)"/g;

for (const file of walk(srcDir)) {
  if (file.includes('/i18n/')) continue;
  const source = readFileSync(file, 'utf8');
  const relative = file.slice(root.length + 1);

  for (const match of source.matchAll(textNodePattern)) {
    const text = match[1].replace(/\s+/g, ' ').trim();
    if (!text || allowedText.has(text)) continue;
    if (!/[A-Za-z]/.test(text)) continue;
    failed = true;
    console.error(`Hardcoded JSX text in ${relative}: "${text}"`);
  }

  for (const match of source.matchAll(attrPattern)) {
    const text = match[2].trim();
    if (allowedText.has(text)) continue;
    failed = true;
    console.error(`Hardcoded ${match[1]} in ${relative}: "${match[2]}"`);
  }
}

if (failed) process.exit(1);
console.log('i18n checks passed.');
