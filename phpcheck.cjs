/*
 * phpcheck.cjs — a local stand-in for `php -l`, for when the monitoring box is unreachable.
 *
 * There is no PHP on this machine, so the only way to lint has been to pipe a file over SSH to the
 * worker server. That link goes down whenever the office IP changes, and "I could not check it"
 * is not an acceptable reason to ship a syntax error into a send worker.
 *
 * This cannot replace a real parser and does not pretend to. What it does catch is the entire class
 * of mistakes that editing PHP through string replacement actually produces: an unbalanced brace,
 * paren or bracket, an unterminated string or comment, a heredoc whose terminator drifted. It does
 * that by walking the file one character at a time with a tiny state machine, so quotes inside
 * comments and braces inside strings are ignored exactly as the real lexer ignores them.
 *
 * Usage: node phpcheck.cjs <file> [file...]
 */
const fs = require('fs');

const OPEN = { '{': '}', '(': ')', '[': ']' };
const CLOSE = { '}': '{', ')': '(', ']': '[' };

function lint(file) {
  const src = fs.readFileSync(file, 'utf8');
  const problems = [];
  const stack = [];
  let line = 1;
  let i = 0;
  // Everything before the first <?php is literal output, not code.
  const open = src.indexOf('<?php');
  if (open === -1) return [`${file}: no <?php open tag found`];
  for (let k = 0; k < open; k++) if (src[k] === '\n') line++;
  i = open + 5;

  const at = () => `${file}:${line}`;

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    if (c === '\n') { line++; i++; continue; }

    // ── comments ──
    if (c === '/' && next === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '#' && next !== '[') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && next === '*') {
      const start = line;
      i += 2;
      let closed = false;
      while (i < src.length) {
        if (src[i] === '\n') line++;
        if (src[i] === '*' && src[i + 1] === '/') { i += 2; closed = true; break; }
        i++;
      }
      if (!closed) problems.push(`${file}:${start}: block comment opened here is never closed`);
      continue;
    }

    // ── heredoc / nowdoc ──
    if (c === '<' && src.startsWith('<<<', i)) {
      const m = /^<<<[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1\r?\n/.exec(src.slice(i));
      if (m) {
        const tag = m[2];
        const start = line;
        i += m[0].length;
        line++;
        // PHP 7.3+ allows the terminator to be indented; it must still be the first thing on its line.
        const term = new RegExp(`^[ \\t]*${tag}\\b`);
        let closed = false;
        while (i < src.length) {
          const eol = src.indexOf('\n', i);
          const lineText = src.slice(i, eol === -1 ? src.length : eol);
          if (term.test(lineText)) {
            i += lineText.search(new RegExp(`${tag}\\b`)) + tag.length;
            closed = true;
            break;
          }
          if (eol === -1) { i = src.length; break; }
          i = eol + 1;
          line++;
        }
        if (!closed) problems.push(`${file}:${start}: heredoc <<<${tag} is never terminated`);
        continue;
      }
    }

    // ── strings ──
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      const start = line;
      i++;
      let closed = false;
      while (i < src.length) {
        if (src[i] === '\\') { if (src[i + 1] === '\n') line++; i += 2; continue; }
        if (src[i] === '\n') line++;
        if (src[i] === quote) { i++; closed = true; break; }
        i++;
      }
      if (!closed) problems.push(`${file}:${start}: string opened with ${quote} is never closed`);
      continue;
    }

    // ── brackets ──
    if (OPEN[c]) { stack.push({ c, line }); i++; continue; }
    if (CLOSE[c]) {
      const top = stack.pop();
      if (!top) problems.push(`${at()}: unexpected '${c}' with nothing open`);
      else if (top.c !== CLOSE[c]) problems.push(`${at()}: '${c}' closes '${top.c}' opened on line ${top.line}`);
      i++;
      continue;
    }

    i++;
  }

  for (const left of stack) problems.push(`${file}:${left.line}: '${left.c}' is never closed`);
  return problems;
}

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node phpcheck.cjs <file.php> ...'); process.exit(2); }

let bad = 0;
for (const f of files) {
  let problems;
  try { problems = lint(f); } catch (e) { problems = [`${f}: ${e.message}`]; }
  if (problems.length) { bad++; problems.forEach(p => console.error('FAIL ' + p)); }
  else console.log('OK   ' + f);
}
process.exit(bad ? 1 : 0);
