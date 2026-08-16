const fs = require('fs');
const s = fs.readFileSync('public/app.js', 'utf8');

// Check BOM
console.log('BOM:', s.charCodeAt(0) === 0xFEFF ? 'yes' : 'no');

// Check nulls
const nulls = s.split('').filter(c => c.charCodeAt(0) === 0).length;
console.log('Null bytes:', nulls);

// The real test: can the browser parse this?
// In browser, <script> tags parse differently than new Function
// Let's try with vm module
const vm = require('vm');
try {
  vm.compileFunction(s);
  console.log('vm.compileFunction: OK');
} catch(e) {
  console.log('vm.compileFunction:', e.message.slice(0, 100));
}

try {
  const script = new vm.Script(s);
  console.log('vm.Script: OK');
} catch(e) {
  console.log('vm.Script:', e.message.slice(0, 100));
}

// Check: does it have a return statement at top level?
const lines = s.split('\n');
for (let i = 0; i < Math.min(10, lines.length); i++) {
  console.log('Line ' + (i+1) + ':', lines[i].slice(0, 100));
}
