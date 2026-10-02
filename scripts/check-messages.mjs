// Fails when a messages file repeats a key in the same object (JSON.parse silently keeps the last one).
//   node scripts/check-messages.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'src', 'messages');
let failed = false;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const src = readFileSync(join(dir, file), 'utf8');
  const stack = [new Set()];
  const dups = [];
  const token = /"((?:[^"\\]|\\.)*)"\s*:|[{}]/g;
  for (let m = token.exec(src); m; m = token.exec(src)) {
    if (m[0] === '{') stack.push(new Set());
    else if (m[0] === '}') stack.pop();
    else {
      const keys = stack[stack.length - 1];
      if (keys.has(m[1])) dups.push(m[1]);
      keys.add(m[1]);
    }
  }
  if (dups.length) {
    failed = true;
    console.error(`${file}: duplicate keys: ${dups.join(', ')}`);
  } else console.log(`${file}: ok`);
}
process.exit(failed ? 1 : 0);
