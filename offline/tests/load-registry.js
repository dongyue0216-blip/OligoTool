'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

module.exports = function loadRegistry(context, root = path.join(__dirname, '..')) {
  for (const file of ['chemistry-library/registry.generated.js', 'app/chemistry-registry.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
  }
};
