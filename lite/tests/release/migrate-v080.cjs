const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'../..'),c=vm.createContext({});
vm.runInContext(fs.readFileSync(process.argv[2]||root+'/app/reference-data.js','utf8'),c);
vm.runInContext(fs.readFileSync(root+'/app/core.js','utf8'),c);
const R=vm.runInContext('REFERENCE',c),C=vm.runInContext('ChemistryCore',c),rows=[];
for(const [id,t]of Object.entries(R.templates)){
 const corrections=[];
 for(const [d,s]of Object.entries(t.attachments||{}))if(!['O','N'].includes(s.element)){delete t.attachments[d];corrections.push('Removed nonreactive '+s.element+' pseudo-site '+d);}
 if(t.attachments?.upstream?.atom===t.attachments?.downstream?.atom&&t.attachments.upstream){
  const remove=t.allowed_positions?.length===1&&t.allowed_positions[0]==='five'?'upstream':'downstream';
  delete t.attachments[remove];corrections.push('Collapsed duplicate atom aliases into one physical attachment');
 }
 for(const [direction,s]of Object.entries(t.attachments||{})){
  if(t.allowed_positions?.includes('five')&&t.allowed_positions?.includes('three')&&Object.keys(t.attachments).length===1)s.reversible=true;
  s.compatibility_domain=({tna:'threose-O3-O2',gna:'glycerol-O3-O2',pmo:'morpholine-O-N'})[t.assembly_class]||'standard-O';
  s.unconnected={state:s.element==='N'?'NH':'OH',hydrogens:1};
 }
 rows.push({id,status:'MIGRATED',corrections,sites:Object.keys(t.attachments||{}),domain:Object.values(t.attachments||{})[0]?.compatibility_domain,legacy_position_flags:{terminal_only:t.terminal_only,allowed_positions:t.allowed_positions}});
}
fs.writeFileSync(root+'/app/reference-data.js','// Offline atomic reference and audited site contracts.\nconst REFERENCE = '+JSON.stringify(R)+';\n');
const blocks=Object.fromEntries(Object.entries(R.templates).map(([id,t])=>[id,C.buildingBlock({...t,id})]));
fs.writeFileSync(root+'/app/master-library.v2.json',JSON.stringify({schema_version:'master-library/2',blocks,linkages:C.linkageDefinitions(R)},null,2));
for(const f of ['coverage-data.js','chemistry.js'])vm.runInContext(fs.readFileSync(root+'/app/'+f,'utf8'),c);
const L=vm.runInContext('Lite',c),master=JSON.parse(fs.readFileSync(root+'/app/master-library.v1.json'));
for(const m of master){const id=m.symbol.startsWith('[')?'{'+m.symbol.slice(1,-1)+'}':m.symbol;if(blocks[id])continue;
 if(['(none)','*','**','^','!','#'].includes(m.symbol)){rows.push({id,status:'LINKAGE_DEFINITION',reason:'Represented by a formal LinkageDefinition, not a BuildingBlock'});continue;}
 if(['[PHO]','[p]','[pp]','[ppp]'].includes(m.symbol)){rows.push({id,status:'TERMINATION_ADAPTER',reason:'Legacy phosphate notation maps to explicit terminal linkage paths'});continue;}
 try{const p=L.parse(m.symbol);if(p.residues.length===1&&blocks[p.residues[0]]){rows.push({id,status:'ALIAS',target:p.residues[0]});continue;}}catch{}
 rows.push({id,status:'UNSUPPORTED',reason:'No reliable atom-level scaffold/attachment/stereo definition in baseline; '+(m.support_status||m.status||'not implemented')});
}
if(!blocks['{C7N}'])rows.push({id:'{C7N}',status:'UNSUPPORTED',reason:'Not present in baseline registry; exact structure and attachment must be provided'});
fs.writeFileSync(root+'/docs/MIGRATION_AUDIT.json',JSON.stringify({version:'0.8.0',baseline:'Lite 0.7.0',migrated:rows.filter(r=>r.status==='MIGRATED').length,rows},null,2));
console.log(JSON.stringify({graphs:Object.keys(blocks).length,domains:Object.fromEntries(Object.entries(blocks).filter(([k])=>['pA','tA','Agn','{C6N}','VpeA'].includes(k)).map(([k,b])=>[k,b.sites]))}));
