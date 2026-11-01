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
 return {ready,coordinates,get status(){return status;}};
})();
