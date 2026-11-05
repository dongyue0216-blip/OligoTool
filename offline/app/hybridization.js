 'use strict';
// A: sequence complementarity candidates only. No thermodynamic or folding model.
const Hybridization=(()=>{
 const copy=x=>JSON.parse(JSON.stringify(x));
 const pair=(a,b)=>({A:['T','U'],T:['A'],U:['A'],C:['G'],G:['C']}[a]||[]).includes(b);
 function resolve(strand,index){
  if(!strand||typeof strand!=='object')throw Error('Invalid strand');
  const raw=copy(strand),id=strand.id||'strand-'+index;
  const residues=Array.isArray(strand.residues)?strand.residues.map(copy):typeof strand.sequence==='string'?Array.from(strand.sequence.replace(/\s/g,'').toUpperCase()).map(token=>({token})):[];
  if(!residues.length||residues.length>500)throw Error('Each strand requires 1–500 residues');
  const unresolved=[];residues.forEach((r,i)=>{const token=r.token; // Never strip bracketed modifications or infer their ordinary base.
   r.position=i;r.baseIdentity=/^[ACGTU]$/.test(token)&&!r.modification?token:null;
   if(!r.baseIdentity)unresolved.push({position:i,raw:copy(r),reason:'No supported explicit base identity'});
  });
  const unknownLinks=(strand.linkages||[]).flatMap((l,i)=>!['PO','PS'].includes(typeof l==='string'?l:l.code)?[{position:i,raw:copy(l),reason:'Unknown linkage retained; no PO fallback'}]:[]);
  const known=residues.length-unresolved.length,status=unresolved.length||unknownLinks.length?(known?'partial':'unresolved'):'exact';
  return {id,raw,residues,chemistryResolution:{status,unresolved:[...unresolved,...unknownLinks],scope:'sequence identity only; not atom graph resolution'}};
 }
 const ref=(s,i)=>({strandId:s.id,residueIndex:i});
 function duplex(a,b){
  let best=null;
  for(let offset=1-b.residues.length;offset<a.residues.length;offset++){
   const columns=[],pairedBaseMap=[],mismatches=[],alignedA=new Set(),alignedB=new Set();let run=0,longest=0;
   for(let i=Math.max(0,offset);i<Math.min(a.residues.length,offset+b.residues.length);i++){
    const j=b.residues.length-1-(i-offset),matched=pair(a.residues[i].baseIdentity,b.residues[j].baseIdentity),column={a:ref(a,i),b:ref(b,j),complementary:matched};columns.push(column);alignedA.add(i);alignedB.add(j);
    if(matched){pairedBaseMap.push([ref(a,i),ref(b,j)]);longest=Math.max(longest,++run);}else{mismatches.push(column);run=0;}
   }
   const score=pairedBaseMap.length*2-mismatches.length;
   const result={strandIds:[a.id,b.id],orientation:'antiparallel',offset,score,columns,pairedBaseMap,pairedCount:pairedBaseMap.length,pairedPercentage:100*pairedBaseMap.length/columns.length,percentageDenominator:'aligned overlap columns',coverage:a.residues.length+b.residues.length?2*pairedBaseMap.length/(a.residues.length+b.residues.length):0,mismatches,longestContinuousComplementaryRun:longest,bulges:{supported:false,reason:'Ungapped offset search; internal bulges are not modeled'},overhangs:[{strandId:a.id,residueIndices:a.residues.map((_,i)=>i).filter(i=>!alignedA.has(i))},{strandId:b.id,residueIndices:b.residues.map((_,i)=>i).filter(i=>!alignedB.has(i))}]};
   if(!best||score>best.score||score===best.score&&longest>best.longestContinuousComplementaryRun||score===best.score&&longest===best.longestContinuousComplementaryRun&&columns.length>best.columns.length)best=result;
  }
  return best;
 }
 function self(s,minLoop,minStem){const candidates=[];let candidateCount=0;const n=s.residues.length;
  for(let i=0;i<n;i++)for(let j=i+minLoop+1;j<n;j++){
   const pairs=[];let left=i,right=j;
   while(right-left-1>=minLoop&&pair(s.residues[left].baseIdentity,s.residues[right].baseIdentity)){pairs.push([ref(s,left++),ref(s,right--)]);}
   if(pairs.length>=minStem){candidateCount++;candidates.push({kind:'hairpinCandidate',pairedBaseMap:pairs,pairedCount:pairs.length,pairedPercentage:100*2*pairs.length/n,percentageDenominator:'all strand residues (2 residues per pair)',longestContinuousComplementaryRun:pairs.length,loop:{start:left,end:right,length:right-left+1},mismatches:[],bulges:{supported:false},overhangs:[{strandId:s.id,residueIndices:[...Array(i).keys(),...Array.from({length:n-j-1},(_,k)=>j+1+k)]}]});if(candidates.length>100){candidates.sort((a,b)=>b.pairedCount-a.pairedCount||a.loop.length-b.loop.length);candidates.pop();}}
  }
  candidates.sort((a,b)=>b.pairedCount-a.pairedCount||a.loop.length-b.loop.length);return {strandId:s.id,candidates:candidates.slice(0,100),candidateCount,truncated:candidateCount>100,algorithm:'contiguous complementary stems with minimum loop; no folding prediction'};
 }
 function analyze(input){
  if(input.schemaVersion!==undefined&&input.schemaVersion!==1)throw Error('Unsupported hybridization schema');
  if(!Array.isArray(input.strands)||!input.strands.length||input.strands.length>16)throw Error('strands[] requires 1–16 entries');
  const strands=input.strands.map(resolve);if(new Set(strands.map(s=>s.id)).size!==strands.length)throw Error('Duplicate strand ID');
  const minLoop=input.minLoop??3,minStem=input.minStem??2;if(!Number.isInteger(minLoop)||minLoop<3||!Number.isInteger(minStem)||minStem<1)throw Error('Invalid stem/loop bounds');
  const result={schema:'oligo-hybridization-analysis',schemaVersion:1,algorithmVersion:'complementarity-ungapped/1',strands,interpretation:'Sequence complementarity candidates only; no annealing stability, Tm, deltaG or modified-oligo thermodynamics',status:strands.every(s=>s.chemistryResolution.status==='exact')?'resolved':'unresolved',selfAnalyses:[],duplexAnalyses:[]};
  if(result.status==='unresolved')return result;
  result.selfAnalyses=strands.map(s=>self(s,minLoop,minStem));for(let i=0;i<strands.length;i++)for(let j=i+1;j<strands.length;j++)result.duplexAnalyses.push(duplex(strands[i],strands[j]));return result;
 }
 // Proposal only: explicit residue→current atom mapping is required before A persists interactions.
 function proposeInteractions(analysis,pairs,residueAtomMap){
  if(analysis.status!=='resolved')throw Error('Unresolved analysis');
  return pairs.map((participants,i)=>({id:'hybridization-pair-'+i,kind:'basePair',status:'candidate',source:{algorithmVersion:analysis.algorithmVersion},participants:participants.map(p=>{const strand=analysis.strands.find(s=>s.id===p.strandId);if(!strand?.residues[p.residueIndex])throw Error('Unknown residue');const atomIndex=residueAtomMap[p.strandId]?.[p.residueIndex];if(!Number.isInteger(atomIndex)||atomIndex<0)throw Error('Explicit atom mapping required');return {...p,atomIndex};})}));
 }
 return {analyze,resolve,proposeInteractions};
})();
