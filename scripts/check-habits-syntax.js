const fs = require('fs');
const s = fs.readFileSync('habits/habits.js', 'utf8');
let i = 0, line = 1, paren = 0, brace = 0, brack = 0, mode = 'code';
const stack = [];
function isRegexStart() {
  // look at previous non-space char
  let j = i - 1;
  while (j >= 0 && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n' || s[j] === '\r')) j--;
  if (j < 0) return true;
  const prev = s[j];
  if (prev === ')' || prev === ']' || prev === '}' || prev === '}' ) return false;
  if (/[A-Za-z0-9_$]/.test(prev)) return false;
  return true;
}
while (i < s.length) {
  const c = s[i];
  if (c === '\n') { line++; i++; continue; }
  if (mode === 'code') {
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '/' && isRegexStart()) {
      mode = 'regex'; i++;
      while (i < s.length) {
        if (s[i] === '\\') { i += 2; continue; }
        if (s[i] === '[') { i++; while (i < s.length && s[i] !== ']') { if (s[i] === '\\') i += 2; else i++; } i++; continue; }
        if (s[i] === '/') { i++; break; }
        i++;
      }
      // flags
      while (i < s.length && /[a-z]/i.test(s[i])) i++;
      mode = 'code'; continue;
    }
    if (c === '"' || c === "'") {
      const q = c; mode = 'str'; i++;
      while (i < s.length) { if (s[i] === '\\') { i += 2; continue; } if (s[i] === q) { i++; break; } i++; }
      mode = 'code'; continue;
    }
    if (c === '`') { mode = 'tpl'; i++; continue; }
    if (c === '(') { paren++; stack.push(['(', line]); }
    else if (c === ')') { paren--; if (paren < 0) { console.log('NEG paren at line', line); break; } stack.pop(); }
    else if (c === '{') { brace++; stack.push(['{', line]); }
    else if (c === '}') { brace--; if (brace < 0) { console.log('NEG brace at line', line); break; } stack.pop(); }
    else if (c === '[') { brack++; }
    else if (c === ']') { brack--; }
  } else if (mode === 'str') {
    if (c === '\\') { i += 2; continue; }
    if (c === '"' || c === "'") { mode = 'code'; i++; continue; }
  } else if (mode === 'regex') {
    // handled inline above; shouldn't reach
  } else if (mode === 'tpl') {
    if (c === '\\') { i += 2; continue; }
    if (c === '`') { mode = 'code'; i++; continue; }
    if (c === '$' && s[i + 1] === '{') { brace++; stack.push(['{', line]); mode = 'tplExpr'; i += 2; continue; }
  } else if (mode === 'tplExpr') {
    if (c === '{') { brace++; stack.push(['{', line]); }
    else if (c === '}') { brace--; stack.pop(); mode = 'tpl'; continue; }
    else if (c === '(') { paren++; stack.push(['(', line]); }
    else if (c === ')') { paren--; stack.pop(); }
    else if (c === '[') { brack++; }
    else if (c === ']') { brack--; }
    else if (c === '"' || c === "'") {
      const q = c; i++;
      while (i < s.length) { if (s[i] === '\\') { i += 2; continue; } if (s[i] === q) { i++; break; } i++; }
      continue;
    } else if (c === '`') { mode = 'tpl'; i++; continue; }
    else if (c === '/' && s[i + 1] === '/' ) { while (i < s.length && s[i] !== '\n') i++; continue; }
    else if (c === '/' && s[i + 1] === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
  }
  i++;
}
console.log('end paren', paren, 'brace', brace, 'brack', brack);
console.log('stack tail', stack.slice(-15));
