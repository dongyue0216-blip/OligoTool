'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = vm.createContext({crypto:require('node:crypto').webcrypto});
const app = path.join(__dirname, '../app');
const load = file => vm.runInContext(fs.readFileSync(path.join(app, file + '.js'), 'utf8'), ctx);
for (const file of ['reference-data', 'coverage-data', 'core', 'chemistry', 'reaction-reagents', 'reactions']) {
 load('snapshots/A/app/' + file);
}
for (const file of ['branch-builtins', 'chemistry-library', 'molecule-builder', 'structure-presentation']) load(file);
const {L, M, C, reference, catalog} = vm.runInContext(
 '({L:Lite,M:MoleculeBuilder,C:StructurePresentation,reference:REFERENCE,catalog:ChemistryLibrary.builtinCatalog()})', ctx
);

const copy = value => JSON.parse(JSON.stringify(value));
const residues = ['A', 'rA', 'tA', 'Agn', '+A', 'cEt-A', 'eA'];
const xna = ['tA', 'Agn'];
const linkages = Object.entries(L.linkageSymbols);
const codeFor = notation => L.parse(notation).residues[0];
const bond = (graph, a, b) => graph.bonds.some(edge =>
 edge.o === 1 && ((edge.a === a && edge.b === b) || (edge.a === b && edge.b === a))
);
const reason = reasonCode => error => error.reasonCode === reasonCode;

function verify(sequence, expectedLinks, expectedCaps = []) {
 const result = L.calculate(sequence);
 const {graph, chemistry, assembly_graph: assembly} = result;
 assert(L.connected(graph), sequence);
 assert.deepEqual(Array.from(result.linkages), expectedLinks, sequence);
 assert.equal(L.parse(result.canonical_sequence).canonical, result.canonical_sequence);
 assert(result.formula_validation.equal, sequence);
 const props = L.graphProperties(graph);
 for (const property of ['formula', 'average_mw', 'exact_mass']) assert.equal(chemistry[property], props[property], sequence);

 const consumed = new Set();
 function attachment(ref, center) {
  const node = assembly.nodes.find(candidate => candidate.id === ref.node);
  const site = node.block.sites[ref.site];
  const atom = graph.provenance.atoms.findIndex(p => p.node === ref.node && p.kind === 'building-block' && p.local_atom === site.atom);
  if (['TNA', 'GNA'].includes(node.block.metadata.family)) {
   assert.equal(site.atom_role, site.direction === 'upstream' ? 'O3' : 'O2');
  }
  assert(atom >= 0 && graph.atoms[atom].h === 0 && bond(graph, atom, center), sequence);
  assert(!consumed.has(atom), sequence);
  consumed.add(atom);
 }
 function linkageCenter(match, code) {
  const definition = L.linkageDefinitions[code];
  const atoms = graph.provenance.atoms.flatMap((p, i) => match(p) ? [i] : []);
  assert(atoms.length >= definition.graph.atoms.length, sequence);
  for (const [i, atom] of definition.graph.atoms.entries()) assert.equal(graph.atoms[atoms[i]].e, atom.e, sequence);
  return atoms[definition.center];
 }
 for (const edge of assembly.edges) {
  const center = linkageCenter(p => p.edge === edge.id, edge.linkage);
  attachment(edge.source, center);
  attachment(edge.target, center);
 }
 const caps = assembly.terminations.filter(t => t.kind === 'linkage');
 assert.deepEqual(Array.from(caps, t => [t.at.site, Array.from(t.linkages)]), expectedCaps, sequence);
 for (const cap of caps) {
  const center = linkageCenter(p => p.termination === cap.id && p.step === 1, cap.linkages[0]);
  attachment(cap.at, center);
 }
 return result;
}

let backboneCount = 0;
for (const left of residues) for (const right of residues) for (const [symbol, code] of linkages) {
 verify(left + symbol + right, [code]);
 backboneCount++;
}
let mixedCount = 0;
for (const middle of xna) for (const [first, left] of linkages) for (const [second, right] of linkages) {
 if (left === right) continue;
 verify('A' + first + middle + second + 'rA', [left, right]);
 mixedCount++;
}
verify('pApA', ['PMO']);
assert.deepEqual(Object.keys(L.linkageDefinitions).sort(), [...linkages.map(([, code]) => code), 'PMO'].sort());
for (const unit of residues) {
 assert.throws(() => L.calculate('pA' + unit), reason('INCOMPATIBLE_SITE_CHEMISTRY'));
 assert.throws(() => L.calculate(unit + 'pA'), reason('SITE_LINKAGE_NOT_ALLOWED'));
}

let phosphateCount = 0;
for (const unit of residues) for (const [symbol, code] of linkages) {
 verify('(p)' + symbol + unit + 'A', ['PO'], [['upstream', [code]]]);
 verify('A' + unit + symbol + '(p)', ['PO'], [['downstream', [code]]]);
 phosphateCount += 2;
}
for (const unit of xna) {
 for (const count of [2, 3]) {
  const cap = '(' + 'p'.repeat(count) + ')';
  verify(cap + unit + cap, [], [['upstream', Array(count).fill('PO')], ['downstream', Array(count).fill('PO')]]);
  for (const [symbol] of linkages.filter(([marker]) => marker)) {
   assert.throws(() => L.calculate(cap + symbol + unit), reason('UNDEFINED_MODIFIED_POLYPHOSPHATE'));
   assert.throws(() => L.calculate(unit + symbol + cap), reason('UNDEFINED_MODIFIED_POLYPHOSPHATE'));
  }
 }
}

const validatedXna = Object.entries(reference.templates)
 .filter(([, block]) => ['TNA', 'GNA'].includes(block.family) && !block.validation_status)
 .map(([id]) => id);
for (const unit of validatedXna) for (const [symbol, code] of linkages) {
 verify('(p)' + symbol + unit + symbol + 'A' + symbol + '(p)', [code], [['upstream', [code]], ['downstream', [code]]]);
}
assert.equal(L.calculate('Ugn').chemistry.formula,'C7H10N2O4');
assert(L.connected(L.calculate('A*Ugn').graph));
assert.equal(L.calculate('[absic]').chemistry.formula, 'C5H10O3');
assert.throws(() => L.calculate('tA[C6N]A'), reason('MISSING_ATTACHMENT_SITE'));
const spdp = catalog.find(row => row.symbol === 'SPDP');
assert(spdp?.roles.includes('ReactionReagent') && !spdp.assemblyReady);

const modifierRows = catalog.filter(row => {
 if (!row.assemblyReady || !Object.hasOwn(reference.templates, row.symbol.replace(/^\[(.*)\]$/, '{$1}'))) return false;
 const block = L.getBuildingBlock(codeFor(row.symbol.replace(/^\{(.*)\}$/, '[$1]')));
 return Object.keys(block?.attachments || {}).length === 1 || /^\[|^\{/.test(row.symbol);
});
const modifiers = modifierRows.map(row => row.symbol.replace(/^\{(.*)\}$/, '[$1]'));
for (const required of ['[C6N]', '[C3N]', '[FAM]', '[NAG37]', '[L96]', '[InvAb]', '[PEG3]', 'VpmA', 'VpeA']) {
 assert(modifiers.includes(required), required);
}
let modifierCount = 0;
for (const modifier of modifiers) for (const unit of residues) for (const [symbol, code] of linkages) {
 verify(modifier + symbol + unit, [code]);
 verify(unit + symbol + modifier, [code]);
 modifierCount += 2;
}

for (const unit of xna) for (const [symbol, code] of linkages) {
 const sequence = '(p)' + symbol + unit + symbol + 'Agn' + symbol + '(p)';
 const {graph, chemistry} = L.calculate(sequence);
 const mol = L.mol(graph);
 for (const exported of [mol, mol + '\n$$$$\n']) {
  const restored = L.parseMol(exported, {manualMarkers:true}).graph;
  assert(L.connected(restored), sequence);
  const properties = L.graphProperties(restored);
  assert.equal(properties.formula, chemistry.formula, sequence);
  assert(Math.abs(properties.exact_mass - chemistry.exact_mass) < 1e-8, sequence);
  assert(Math.abs(properties.average_mw - chemistry.average_mw) < 1e-8, sequence);
 }
 assert(L.cdxml(graph).includes('<CDXML'), sequence);
 const state = M.restore(M.exportJSON(M.start(sequence)));
 assert.equal(state.formula, chemistry.formula);
 const view = C.schematic({moleculeState:state});
 assert(view.supported && view.svg.includes('upstream → downstream') && !view.svg.includes('5′ → 3′'), sequence);
 assert(view.svg.includes('data-linkage="' + code + '"'), sequence);
}

const valid = L.toAssemblyGraph('A*tA');
for (const code of ['missing', 'constructor']) {
 const input = copy(valid);
 input.edges[0].linkage = code;
 assert.throws(() => L.expandAssemblyGraph(input), reason('UNDEFINED_LINKAGE'));
}
const wrongRole = copy(valid);
wrongRole.edges[0].source.site = 'upstream';
assert.throws(() => L.expandAssemblyGraph(wrongRole), reason('INCOMPATIBLE_SITE_DIRECTION'));
const repeated = copy(valid);
repeated.edges.push({...copy(repeated.edges[0]), id:'repeat'});
assert.throws(() => L.expandAssemblyGraph(repeated), reason('ATTACHMENT_ALREADY_USED'));
assert.throws(() => L.calculate('(p)[C6N]tA'), reason('MISSING_ATTACHMENT_SITE'));
assert.equal(L.calculateSafe('tA**(pp)').errors[0].reasonCode, 'UNDEFINED_MODIFIED_POLYPHOSPHATE');

const parent = M.start('[GlycerolBranch]A');
const site = M.available(parent)[0];
assert(site);
const branched = M.branch(parent, {siteId:site.id, sequence:'tA**Agn', linkage:'MsPA', childEnd:'start'});
assert(L.connected(branched.graph));
assert(!M.available(branched).some(available => available.id === site.id));
assert.equal(M.restore(M.exportJSON(branched)).formula, branched.formula);
const combined = M.combine([M.start('tA'), M.start('Agn')]);
const source = combined.attachmentSites.find(s => s.direction === 'downstream');
const target = combined.attachmentSites.find(s => s.path !== source.path && s.direction === 'upstream');
assert(L.connected(M.connect(combined, {source, target, linkage:'PS2'}).graph));

console.log(JSON.stringify({backboneCount, mixedCount, phosphateCount, validatedXna, modifierCount, modifiers, exportCount:xna.length * linkages.length}, null, 2));
