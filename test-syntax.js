const fs = require('fs');
const s = fs.readFileSync('public/app.js', 'utf8');
const lines = s.split('\n');

// Test specific segments of line 4
const l4 = lines[3];
console.log('Line 4:', l4);
console.log('Length:', l4.length);
console.log('Chars:');
for (let i = 0; i < l4.length; i++) {
  const c = l4.charCodeAt(i);
  if (c > 127 || c < 32) {
    console.log(`  pos ${i}: code=${c} hex=${c.toString(16)} char=${l4[i]}`);
  }
}

// Binary search within line 4 for the exact error
let lo = 0, hi = l4.length;
while (lo < hi) {
  const mid = Math.floor((lo + hi) / 2);
  try { 
    new Function('function esc(){return ' + l4.slice(21, mid + 1) + '}');
    lo = mid + 1;
  } catch(e) {
    if (e.message.includes('Unexpected end')) { lo = mid + 1; }
    else { hi = mid; }
  }
}
console.log('Error around pos:', lo, 'char:', l4[lo], 'hex:', l4.charCodeAt(lo).toString(16));
console.log('Context:', JSON.stringify(l4.slice(Math.max(0, lo-20), lo+20)));
