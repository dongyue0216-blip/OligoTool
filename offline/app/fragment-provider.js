'use strict';
const SmallFragmentDepictor=(()=>{
 let engine=null,status='initializing';
 const ready=initRDKitModule({instantiateWasm:(imports,done)=>{WebAssembly.instantiate(window.RDKIT_BYTES,imports).then(x=>done(x.instance,x.module));return {};}}).then(r=>{engine=r;status='RDKit '+r.version();return status;}).catch(e=>{status='Not yet integrated: '+String(e);return status;});
 const signature=g=>JSON.stringify({a:g.atoms.map(a=>[a.e,a.h,a.q||0,a.s||0,a.iso||0]),b:g.bonds.map(b=>[b.a,b.b,b.o,b.s||0])});
 function coordinates(record){const g=record.graph;
  // Whole oligos and reaction products carrying an oligo are never passed to generic layout.
  if(record.assemblyGraph||g.photometry||g.atoms.length>250)return {graph:g,status:'semantic bamboo / provenance composition; generic oligo redraw prohibited'};
  if(!engine)return {graph:g,status:status};
  if(g.atoms.some(a=>a.s)||g.bonds.some(b=>b.s))return {graph:g,status:'stereo gate: retained source geometry'};
  let mol;try{mol=engine.get_mol(Lite.mol(g));if(!mol)throw Error('RDKit parse rejected');mol.set_new_coords(false);const back=Lite.parseMol(mol.get_molblock(),{manualMarkers:true}).graph;if(signature(g)!==signature(back))throw Error('identity/index/stereo gate rejected');const drawing=Sandbox.clone(g);drawing.atoms.forEach((a,i)=>{a.x=back.atoms[i].x;a.y=back.atoms[i].y;});return {graph:drawing,status:status+' default · coordinates only · identity gate PASS'};}catch(e){return {graph:g,status:'source geometry fallback: '+e.message};}finally{mol?.delete();}}
 function productIdentity(graph){
  if(!engine||graph.atoms.some(atom=>atom.s))return null;
  let molecule;
  try{
   molecule=engine.get_mol(Lite.mol(graph),JSON.stringify({removeHs:false}));
   return molecule?.get_smiles()||null;
  }catch{return null;}finally{molecule?.delete();}
 }
 // Use RDKit only to localize explicit V2000 aromatic bonds. Keep the original
 // atom records, bond stereo, SGroups and SDF metadata for the regular importer.
 function localizeAromaticBonds(text){
  const lines=text.replace(/\r/g,'').split('\n');
  if(!engine||!lines[3]?.includes('V2000'))return null;
  const counts=lines[3],atoms=Number(counts.slice(0,3)),bonds=Number(counts.slice(3,6));
  const start=4+atoms,end=start+bonds,endRecord=lines.findIndex(line=>line.startsWith('M  END'));
  if(!atoms||!bonds||endRecord<end||!lines.slice(start,end).some(line=>Number(line.slice(6,9))===4))return null;
  let molecule;
  try{
   molecule=engine.get_mol(lines.slice(0,endRecord+1).join('\n')+'\n',JSON.stringify({removeHs:false}));
   if(!molecule)return null;
   const localized=molecule.get_molblock().split('\n');
   if(!localized[3]?.includes('V2000')||localized[3].slice(0,6)!==counts.slice(0,6))return null;
   for(let i=4;i<start;i++)if(lines[i].slice(31,34)!==localized[i].slice(31,34))return null;
   const endpoints=line=>[Number(line.slice(0,3)),Number(line.slice(3,6))].sort((a,b)=>a-b).join(':');
   const orders=new Map(localized.slice(start,end).map(line=>[endpoints(line),Number(line.slice(6,9))]));
   if(orders.size!==bonds)return null;
   for(let i=start;i<end;i++){
    const line=lines[i],before=Number(line.slice(6,9)),after=orders.get(endpoints(line));
    if(before===4){
     if(after!==1&&after!==2)return null;
     lines[i]=line.slice(0,6)+String(after).padStart(3)+line.slice(9);
    }else if(before!==after)return null;
   }
   return lines.join('\n');
  }catch{return null;}finally{molecule?.delete();}
 }
 return {ready,coordinates,productIdentity,localizeAromaticBonds,get status(){return status;}};
})();
