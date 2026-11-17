const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
function load(p){const c=vm.createContext({module:{exports:{}}});vm.runInContext(read(p),c);return c.module.exports;}
const old=load('infinity/base/app/snapshots/C/presentation.js');
const current=load('infinity/inf/app/snapshots/C/presentation.js');
let seed=4801;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const rows=[];
for(let n=0;n<80;n++){
 const atoms=Array.from({length:40},()=>({e:'C',h:0,x:random()*80-40,y:random()*80-40}));
 const bonds=atoms.slice(1).map((_,i)=>({a:i,b:i+1,o:1}));
 const moving=[0,1,2,3,4,5],groups=[{id:'moving',atoms:moving}];
 const joins=[5];
 if(n%2===0){bonds.push({a:2,b:30,o:1});joins.push(bonds.length-1);}
 const input={graph:{atoms,bonds},semantics:{groups,placements:[{group:'moving',bonds:joins}]}};
 const before=JSON.stringify(input);
 assert.equal(JSON.stringify(current.layout(input)),JSON.stringify(old.layout(input)),'scene '+n);
 assert.equal(JSON.stringify(input),before,'input mutated');
 rows.push({scene:n,status:'PASS'});
}
fs.writeFileSync('infinity/qa/spatial-equivalence.json',JSON.stringify(rows,null,2));
console.log(rows.length+'/'+rows.length);
