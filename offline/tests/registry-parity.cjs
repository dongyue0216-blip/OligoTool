'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');

const root = path.join(__dirname, '..');
const fixture = path.join(__dirname, 'BUILTIN_V230_PARITY.json');
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const snapshots = 'app/snapshots/A/app/';

function snapshot(dir, legacy) {
  const ctx = vm.createContext({});
  const evalIn = source => vm.runInContext(source, ctx);
  const load = file => vm.runInContext(read(dir, file), ctx, {filename: file});
  if (legacy) {
    for (const file of ['reference-data', 'coverage-data', 'reaction-reagents']) load(snapshots + file + '.js');
  } else {
    require('./load-registry.js')(ctx, dir);
  }
  load(snapshots + 'core.js');
  load(snapshots + 'chemistry.js');
  load(snapshots + 'reactions.js');
  if (legacy) load('app/branch-builtins.js');
  load('app/snapshot-data.js');

  const optical = legacy
    ? evalIn(read(dir, 'app/optical.js').match(/ const negligible = [\s\S]*?(?= const tiers=)/)[0] +
      '({negligible:[...negligible],nucleosideSource,modifiedMonomers,attachmentParameters,pack})')
    : evalIn(`({
        negligible: BuiltinChemistry.opticalCorrections.negligible,
        nucleosideSource: BuiltinChemistry.opticalBases.nucleosideSource,
        modifiedMonomers: BuiltinChemistry.opticalBases.modifiedMonomers,
        attachmentParameters: BuiltinChemistry.opticalAttachments,
        pack: BuiltinChemistry.opticalCorrections.pack
      })`);
  const reduction = legacy
    ? evalIn('(' + read(dir, snapshots + 'reactions.js')
      .match(/const definition=(\{schema_version:'reaction-definition\/2',id:c.transformation_id,.*?\});/)[1]
      .replace('c.transformation_id', JSON.stringify('disulfide-reduction/2')) + ')')
    : evalIn('BuiltinChemistry.reductionDefinition');
  const {templates, links, linkRules, ...reference} = evalIn('REFERENCE');
  const recordHashes = records => Object.fromEntries(Object.entries(records).map(([id, record]) => [id, digest(record)]));
  return {
    templateOrder: Object.keys(templates),
    templates: recordHashes(evalIn(`Object.fromEntries(Object.entries(REFERENCE.templates).map(([id, raw]) =>
      [id, {raw, block: ChemistryCore.buildingBlock({...raw, id}), properties: Lite.graphProperties(raw)}]))`)),
    linkageOrder: Object.keys(links),
    linkages: recordHashes(Object.fromEntries(Object.keys(links).map(id =>
      [id, [links[id], linkRules[id], evalIn('Lite.linkageDefinitions')[id]]]))),
    reagentOrder: Object.keys(evalIn('REACTION_REAGENTS')),
    reagents: recordHashes(evalIn(`Object.fromEntries(Object.entries(REACTION_REAGENTS).map(([id, raw]) =>
      [id, {raw, properties: Lite.graphProperties(raw.graph)}]))`)),
    legacyReagents: recordHashes(evalIn('SNAPSHOT_DATA.reagents')),
    reference: recordHashes(reference),
    coverage: digest(evalIn('COVERAGE')),
    optical: recordHashes(optical),
    reactionDefinitions: recordHashes(evalIn('Reactions.definitions')),
    reactionFamilies: recordHashes(evalIn('Reactions.v2.families')),
    reactionTransformations: recordHashes(evalIn('Reactions.v2.registry')),
    reductionDefinition: digest(reduction),
    ctfileAbbreviations: recordHashes(legacy
      ? JSON.parse(read(dir, snapshots + 'chemistry.js').match(/const abbreviationDefinitions=Object.freeze\((.*)\);/)[1])
      : evalIn('BuiltinChemistry.abbreviations')),
    presentation: digest(evalIn('SNAPSHOT_DATA.templates'))
  };
}

execFileSync(process.execPath, [path.join(root, 'chemistry-library/build-registry.cjs'), '--check']);
const baseline = process.argv[2]
  ? snapshot(path.resolve(process.argv[2]), true)
  : JSON.parse(fs.readFileSync(fixture, 'utf8'));
if (process.argv[3] === '--capture-baseline') {
  fs.writeFileSync(fixture, JSON.stringify(baseline, null, 2) + '\n');
}
const current = snapshot(root, false);
for (const [section, expected] of Object.entries(baseline)) {
  assert.deepEqual(current[section], expected, 'Registry differs in ' + section);
}
for (const section of ['templates', 'linkages', 'reagents', 'legacyReagents', 'reactionDefinitions',
  'reactionFamilies', 'reactionTransformations', 'ctfileAbbreviations']) {
  console.log(section + ': ' + Object.keys(current[section]).length + ' identical records');
}
console.log('Registry parity passed, including optical parameters, coverage, order and presentation templates.');
