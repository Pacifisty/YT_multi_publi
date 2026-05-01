const fs = require('fs');
const src = fs.readFileSync('apps/api/src/frontend/public/app.js', 'utf8');
const re = /'([^']*)'|\"([^\"]*)\"|([\s\S]*?)/g;
const out = [];
for (const m of src.matchAll(re)) {
  const s = m[1] ?? m[2] ?? m[3] ?? '';
  if (!s) continue;
  if (s.length < 3) continue;
  if (s.includes('\n')) continue;
  if (/\b(const|let|var|function|return|=>|class|new|import|from|body|html|head|root|style|script|link|href|text|span|div|true|false|null|undefined|id|class|title|name|value|type|src|alt|aria|button|meta|img|form|input|select|option|table|tr|td|th|ul|li|ol|a|href|path|srcset|role|size|type|key|code|plan|planos|dashboard|videos|campanas|campanhas)\b/.test(s)) continue;
  if (/^(\{|\}|\(|\)|\[|\]|\.|,|\.)$/.test(s.trim())) continue;
  if (s.includes('\\')) continue;
  if (/^\s+$/.test(s)) continue;
  out.push(s.trim());
}
const uniq = [...new Set(out)];
for (const item of uniq.slice(0, 4000)) {
  if (item.length > 120) continue;
  console.log(item);
}
