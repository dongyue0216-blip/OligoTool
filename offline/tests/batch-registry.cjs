'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function run(root) {
  const context = vm.createContext({
    setTimeout, performance, TextEncoder, TextDecoder, Uint8Array,
    JSZip: require(path.join(root, 'vendor/jszip.min.js')),
    XLSX: require(path.join(root, 'vendor/xlsx.full.min.js'))
  });
  const html = fs.readFileSync(path.join(root, 'Start.html'), 'utf8');
  const files = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
  const modules = /\/(?:registry\.generated|chemistry-registry|reference-data|coverage-data|core|chemistry|optical|reaction-reagents|reactions|presentation|engine|snapshot-data|adapters|validation|branch-builtins|batch)\.js$/;
  for (const file of files.filter(file => modules.test(file))) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
  }
  return vm.runInContext(`(async () => {
    Lite.registerCustom('BatchDiol', Lite.selectAttachments(Lite.parseSmiles('OCCO'), 0, 3));
    const sequences = ['dA*dC', 'rArC', '[FAM]mA#fU', 'rA[GlycerolBranch]rC', 'rA[BatchDiol]rC', '[unknown]'];
    const rows = sequences.map((Sequence, i) => ({ID: 'sample-' + i, Sequence}));
    const result = await Batch.run(rows, {formats: ['svg', 'mol', 'sdf', 'cdxml']});
    const xlsx = XLSX.write(Batch.workbook(result), {bookType: 'xlsx', type: 'array'});
    const book = XLSX.read(xlsx, {type: 'array'});
    const batchRows = XLSX.utils.sheet_to_json(book.Sheets.Results);
    const structures = await Promise.all(Object.entries(result.zip.files).map(async ([name, file]) =>
      [name, await file.async('string')]));
    return JSON.stringify({batchRows, structures, sheets: book.SheetNames});
  })()`, context);
}

(async () => {
  const current = await run(path.join(__dirname, '..'));
  const {batchRows, structures, sheets} = JSON.parse(current);
  assert.deepEqual(sheets, ['Results', 'Summary']);
  assert.equal(batchRows.filter(row => row.Formula).length, 5);
  assert.equal(batchRows.filter(row => row['Structure Status'] === 'OK').length, 5);
  assert.equal(structures.length, 20);
  if (process.argv[2]) assert.equal(current, await run(path.resolve(process.argv[2])), 'Batch differs from baseline');
  console.log('Batch: 5 valid rows and 1 rejected row, XLSX round trip and 20 structure exports passed' +
    (process.argv[2] ? ', all identical to baseline.' : '.'));
})().catch(error => { console.error(error); process.exitCode = 1; });
