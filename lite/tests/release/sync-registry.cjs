// Generate offline catalogue snapshots from the runtime registry; fail checks on drift.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'../..'),c=vm.createContext({});vm.runInContext(fs.readFileSync(root+'/app/reference-data.js','utf8'),c);
const R=vm.runInContext('REFERENCE',c),file=root+'/app/master-library.v1.json',master=JSON.parse(fs.readFileSync(file)),check=process.argv.includes('--check');
const blocks={schema_version:'building-block/2',blocks:R.templates};
for(const m of master){const id=m.symbol.startsWith('[')?'{'+m.symbol.slice(1,-1)+'}':m.symbol,t=R.templates[id];if(!t)continue;m.registry_id=id;m.schema_version='building-block/2';m.final_product_graph={atoms:t.atoms,bonds:t.bonds};m.attachments=t.attachments;m.assembly_class=t.assembly_class;m.topology=t.topology;m.attachment_direction='upstream→downstream';}
const audit=Object.entries(R.templates).map(([id,t])=>({id,family:t.family,topology:t.topology,assembly_class:t.assembly_class,attachments:t.attachments}));
for(const [name,data]of [['app/building-block-registry.json',blocks],['app/master-library.v1.json',master],['tests/evidence/REGISTRY_AUDIT_v080.json',audit]]){
 const dest=root+'/'+name;if(check)assert.deepStrictEqual(JSON.parse(fs.readFileSync(dest)),JSON.parse(JSON.stringify(data)),name+' registry drift');else fs.writeFileSync(dest,JSON.stringify(data,null,2)+'\n');
}
console.log((check?'Verified':'Generated')+' registry, catalogue and audit snapshots: '+Object.keys(R.templates).length+' graphs');
