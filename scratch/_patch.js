const fs = require('fs');
const p = 'react-api/api/journeys/lib/JourneyEngine.php';
let s = fs.readFileSync(p, 'utf8');
const add = fs.readFileSync('scratch/_engine_patch.php', 'utf8');
const anchor = "        WHERE j.id = $jid\");";
const i = s.lastIndexOf(anchor);
if (i < 0) { console.error('anchor missing'); process.exit(1); }
const cut = i + anchor.length;
fs.writeFileSync(p, s.slice(0, cut) + add + s.slice(cut));
console.log('engine patched at offset', i);
