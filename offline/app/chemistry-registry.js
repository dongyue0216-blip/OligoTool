'use strict';
// Compatibility views for the existing A APIs. User chemistry has its own store.
const BuiltinChemistry = (() => {
  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }

  const data = BUILTIN_CHEMISTRY_DATA;
  const {dnaMono, rnaMono} = data.opticalBases;
  const linkages = Object.entries(data.linkages);
  const reference = {
    ...data.reference,
    templates: data.templates,
    links: Object.fromEntries(linkages.map(([id, {graph}]) => [id, graph])),
    linkRules: Object.fromEntries(linkages.map(([id, {rule}]) => [id, rule])),
    dnaMono, rnaMono, dnaNN: data.dnaNN, rnaNN: data.rnaNN,
    golden: data.golden
  };
  return freeze({...data, reference});
})();
const REFERENCE = BuiltinChemistry.reference;
const COVERAGE = BuiltinChemistry.coverage;
const REACTION_REAGENTS = BuiltinChemistry.reagents;
