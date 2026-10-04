'use strict';
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const head = fs.readFileSync(require('path').join(__dirname, '../shell.html'), 'utf8').split('</head>')[0];
function launch(installed, embedded) {
  const destinations = [];
  const context = { navigator: {}, matchMedia: () => ({ matches: installed }), location: { replace: p => destinations.push(p) } };
  context.window = context; context.top = embedded ? {} : context;
  for (const m of head.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInNewContext(m[1], context);
  return destinations;
}
assert.deepEqual(launch(true, false), ['collection/'], 'Existing installed Giungla icon must open the collection');
assert.deepEqual(launch(false, false), [], 'Original game URL must still work in browser');
assert.deepEqual(launch(true, true), [], 'Embedded Giungla must not loop back into the collection');
console.log('PASS: existing installed icon opens collection, original game and embedded game still start normally');
