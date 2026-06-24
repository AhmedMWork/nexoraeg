import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const includeDirs = ['src', 'supabase', 'scripts'];
const failures = [];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git'].includes(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const files = includeDirs.flatMap((dir) => walk(join(root, dir))).filter((file) => /\.(ts|tsx|js|mjs|sql|md)$/.test(file));

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (file !== join(root, 'scripts', 'v5-audit-check.mjs') && text.includes('Sent / متابعة 2')) failures.push(`${file}: old follow-up placeholder`);
  if (/label:\s*['"]متابعة 2['"]/.test(text)) failures.push(`${file}: visible متابعة 2 label`);
  if (/totalDeliveryFee\s*[+)]/.test(text) && file.includes('create-order')) failures.push(`${file}: review totalDeliveryFee math`);
}

if (failures.length) {
  console.error('V5 audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`V5 audit passed (${files.length} files scanned).`);
