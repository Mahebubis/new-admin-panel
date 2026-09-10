/* Syntax-check JSX/JS files with @babel/parser (no node_modules in user_dashboard,
   and there is no local PHP, so this is the fastest correctness gate we have). */
const babel = require('@babel/parser');
const fs = require('fs');

const files = process.argv.slice(2);
let bad = 0;
for (const f of files) {
  try {
    babel.parse(fs.readFileSync(f, 'utf8'), {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'topLevelAwait'],
    });
    console.log('OK   ' + f);
  } catch (e) {
    bad++;
    console.log('FAIL ' + f + '\n     ' + e.message);
  }
}
process.exit(bad ? 1 : 0);
