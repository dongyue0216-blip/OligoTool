'use strict';
const Annealing=(()=>{
 const algorithmVersion='ungapped/2', profile='sirna-screen/1';
 const rnaLike=new Set(['RNA','OMe','F','MOE','LNA','cEt']);
 const screenFamilies=new Set(['RNA','OMe','F','DNA']);
 const scores={canonical:2,'canonical-like':2,wobble:0,noncanonical:0,mismatch:-2,abasic:-3,unknown:-2,terminalOverhang:-1};
 const paired=kind=>kind==='canonical'||kind==='canonical-like';
 function resolve(snapshot,laneSelector){
  const lane=Optical.assembly(snapshot);
  const ref={stateId:snapshot.id??null,graphRevision:snapshot.graphRevision??null,
   graphDigest:snapshot.graph?Optical.graphDigest(snapshot.graph):null,laneId:lane?.laneId??null};
  const unresolved=code=>({schema:'StrandView/1',snapshot:ref,direction:null,orderedPositions:[],junctionRefs:[],terminalRefs:[],
   topologyStatus:'unresolved',diagnostics:[code]});
  if(!lane||(laneSelector&&laneSelector!==lane.laneId))return unresolved('UNMAPPED_PRODUCT_REGION');
  const {nodes,edges,terminations}=lane.assembly;
  if(nodes.length>500)return unresolved('POSITION_LIMIT_EXCEEDED');
  const positions=[],terminalRefs=[],diagnostics=[];
  for(const [index,node] of nodes.entries()){
   const {block}=node,{family,base,topology}=block.metadata;
   if(family==='inverted-dSpacer')return unresolved('UNSUPPORTED_POLARITY');
   const known=Optical.builtin(block);
   const abasic=known&&topology==='baseless-sugar';
   const identity=known&&['A','C','G','U','T','CMe','I'].includes(base)?base:null;
   const linkageRefs=edges.slice(Math.max(0,index-1),index+1).filter(e=>e.source.node===node.id||e.target.node===node.id);
   const position={...ref,nodeId:node.id,blockId:block.id,index5p:positions.length+1,
    baseIdentity:identity,pairingClass:abasic?'abasic':identity?'base':'unknown',sugarFamily:family||null,
    linkageRefs,modifications:family&& !['DNA','RNA'].includes(family)?[block.id]:[],polarity:node.orientation,resolution:identity||abasic?'resolved':'unresolved',node};
   if(!identity&&!abasic&&(index===0||index===nodes.length-1)&&Object.keys(block.sites).length===1){
    terminalRefs.push({...position,end:index===0?'5′':'3′'});continue;
   }
   if(node.orientation==='reverse')return unresolved('UNSUPPORTED_POLARITY');
   if(position.resolution==='unresolved')diagnostics.push('UNRESOLVED_BLOCK');
   positions.push(position);
  }
  if(!positions.length)return unresolved('NO_ANALYZABLE_POSITIONS');
  for(const t of terminations||[]){
   if(t.kind!=='linkage')continue;
   terminalRefs.push({end:t.at.site==='upstream'?'5′':'3′',blockId:t.linkages.join('/'),termination:t});
  }
  const positionIds=new Set(positions.map(p=>p.nodeId));
  const junctionRefs=edges.filter(e=>positionIds.has(e.source.node)&&positionIds.has(e.target.node));
  if(junctionRefs.length!==positions.length-1||junctionRefs.some((e,i)=>e.source.node!==positions[i].nodeId||
   e.target.node!==positions[i+1].nodeId||e.source.site!=='downstream'||e.target.site!=='upstream'))
   return unresolved('UNSUPPORTED_POLARITY');
  return {schema:'StrandView/1',snapshot:ref,direction:'5′→3′',orderedPositions:positions,junctionRefs,terminalRefs,
   topologyStatus:diagnostics.length?'partial':'resolved',diagnostics:[...new Set(diagnostics)]};
 }
 function classify(a,b){
  if(!a||!b)return 'terminalOverhang';
  if(a.pairingClass==='abasic'||b.pairingClass==='abasic')return 'abasic';
  if(!a.baseIdentity||!b.baseIdentity)return 'unknown';
  const pair=[a.baseIdentity,b.baseIdentity].sort().join('/');
  if(['A/T','A/U','C/G'].includes(pair))return 'canonical';
  if(pair==='CMe/G')return 'canonical-like';
  if(rnaLike.has(a.sugarFamily)&&rnaLike.has(b.sugarFamily)){
   if(pair==='G/U')return 'wobble';
   if(pair==='C/I')return 'noncanonical';
  }
  return 'mismatch';
 }
 const isGC=(a,b)=>[a.baseIdentity,b.baseIdentity].includes('G');
 function align(a,b,offset,design){
  const columns=[],pairs=[],overhangs={a5:[],a3:[],b5:[],b3:[]},runs=[];
  let score=0,overlap=0,gc=0,run=null;
  for(let i=Math.min(0,offset);i<Math.max(a.length,offset+b.length);i++){
   const j=b.length-1-(i-offset),left=a[i],right=b[j],kind=classify(left,right);
   const column={a:left?.index5p??null,b:right?.index5p??null,kind};
   columns.push(column);
   if(left&&right)overlap++;
   if(kind==='terminalOverhang'){
    const end=left?(j>=b.length?'a5':'a3'):(i<0?'b3':'b5');
    const index=left?column.a:column.b;
    overhangs[end].push(index);
    if(!design?.overhangs?.[end]?.includes(index))score+=scores[kind];
   }else score+=scores[kind];
   if(paired(kind)){
    pairs.push(column);
    if(!run){run={length:0,gc:0,first:column,last:column};runs.push(run);}
    run.length++;run.last=column;
    if(isGC(left,right)){gc++;run.gc++;}
   }else run=null;
  }
  const longestRun=runs.reduce((longest,r)=>Math.max(longest,r.length),0);
  const first=columns.indexOf(pairs[0]),last=columns.indexOf(pairs.at(-1));
  const within=(position,range)=>range&&position!==null&&position>=range[0]&&position<=range[1];
  const core=design?.coreA||design?.coreB?columns.filter(c=>within(c.a,design.coreA)||within(c.b,design.coreB)):
   first<0?[]:columns.slice(first,last+1);
  const disruptions=core.flatMap((c,i)=>paired(c.kind)?[]:[{...c,coreIndex:i+1}]);
  for(const tail of Object.values(overhangs))tail.sort((x,y)=>x-y);
  return {offset,score,columns,pairs,overhangs,runs,longestRun,gc,auAt:pairs.length-gc,overlap,disruptions,coreLength:core.length,
   pairedFractions:{a:pairs.length/a.length,b:pairs.length/b.length,overlapIdentity:overlap?pairs.length/overlap:null}};
 }
 const ranking=(a,b)=>b.score-a.score||b.longestRun-a.longestRun||b.pairs.length-a.pairs.length||b.overlap-a.overlap;
 function scan(a,b,design){
  const results=[];
  for(let offset=1-b.length;offset<a.length;offset++)results.push(align(a,b,offset,design));
  return results.sort((x,y)=>ranking(x,y)||x.offset-y.offset);
 }
 function contextLimited(strand){
  const {orderedPositions,junctionRefs}=strand;
  const ps=junctionRefs.filter(e=>e.linkage==='PS').length;
  return orderedPositions.some((p,i)=>p.pairingClass==='abasic'||!screenFamilies.has(p.sugarFamily)||
    p.sugarFamily==='DNA'&&i<orderedPositions.length-2)||
   junctionRefs.some((e,i)=>e.linkage!=='PO'&&!(e.linkage==='PS'&&ps<=2&&Optical.endPS(i,junctionRefs.length)))||
   strand.terminalRefs.some(t=>t.termination&&t.termination.linkages.some(link=>!['PO','PS'].includes(link)));
 }
 function feasibility(a,b,result,ambiguous,design){
  const positions=[a,b].map(s=>s.orderedPositions);
  if([a,b].some(s=>s.topologyStatus!=='resolved'))return 'Unresolved';
  if(positions.some(p=>p.length<17||p.length>30||p.some(x=>['TNA','GNA','PMO'].includes(x.sugarFamily)))||
   !positions.every(p=>p.some(x=>rnaLike.has(x.sugarFamily))))return 'Not assessed';
  const compatibleEnds=design?.overhangs?
   Object.keys(result.overhangs).every(end=>JSON.stringify(result.overhangs[end])===JSON.stringify(design.overhangs[end]||[])):
   !result.overhangs.a5.length&&!result.overhangs.b5.length&&result.overhangs.a3.length<=2&&result.overhangs.b3.length<=2;
  const compatible=result.pairs.length>=17&&result.pairs.length===result.overlap&&!result.disruptions.length&&compatibleEnds;
  const likely=result.pairs.length>=15&&Math.min(result.pairedFractions.a,result.pairedFractions.b)>=0.75&&
   result.longestRun>=10&&result.disruptions.length<=1&&result.disruptions.every(c=>
    (c.coreIndex-0.5)/result.coreLength<1/3||(c.coreIndex-0.5)/result.coreLength>2/3);
  if(!ambiguous&&!contextLimited(a)&&!contextLimited(b)){
   if(compatible)return 'Compatible';
   if(likely)return 'Likely';
  }
  if(compatible||likely||(result.pairs.length>=8&&result.longestRun>=5))return 'Partial';
  return 'Poor';
 }
 function duplex(a,b,requestedProfile=profile,design){
  if(requestedProfile!==profile)throw Error('Unsupported annealing profile');
  const out={schema:'DuplexResult/2',algorithmVersion,profile,evidence:{tier:'heuristic',basis:'Sequence screen'}};
  const left=a.orderedPositions,right=b.orderedPositions;
  if(!left.length||!right.length)return {...out,feasibility:'Unresolved',reasonCodes:[...a.diagnostics,...b.diagnostics],columns:[],pairs:[]};
  const [best,...others]=scan(left,right,design);
  const ties=others.filter(r=>ranking(best,r)===0);
  const declared=Number.isInteger(design?.offset)&&design.offset>=1-right.length&&design.offset<left.length?
   align(left,right,design.offset,design):null;
  const selected=declared||best;
  if(design?.offset!==undefined&&!declared)throw Error('Declared register is outside the ungapped overlap range');
  for(const [range,n] of [[design?.coreA,left.length],[design?.coreB,right.length]])if(range&&
   (!Array.isArray(range)||range.length!==2||!range.every(Number.isInteger)||range[0]<1||range[0]>range[1]||range[1]>n))
   throw Error('Declared core must use a valid inclusive 5′ index range');
  const reasonCodes=[...a.diagnostics,...b.diagnostics];
  if(ties.length)reasonCodes.push('AMBIGUOUS_REGISTER');
  if(declared&&declared.offset!==best.offset)reasonCodes.push('DECLARED_REGISTER_DIFFERS');
  if(contextLimited(a)||contextLimited(b))reasonCodes.push('UNVALIDATED_CHEMICAL_CONTEXT');
  if([...a.terminalRefs,...b.terminalRefs].some(t=>!t.termination&&!Optical.reviewedNegligible(t.node.block)))
   reasonCodes.push('TERMINAL_CHEMISTRY_UNASSESSED');
  const state=feasibility(a,b,selected,ties.length>0,design);
  const fraction=selected.gc/selected.pairs.length;
  if(['Compatible','Likely'].includes(state)&&(fraction<0.25||fraction>0.75))reasonCodes.push(fraction<0.25?'AU_AT_RICH':'GC_RICH');
  const coverage=(side,range)=>{
   if(!range)return null;
   const indices=selected.pairs.filter(p=>p[side]>=range[0]&&p[side]<=range[1]).length;
   return indices/(range[1]-range[0]+1);
  };
  return {...out,...selected,selectedRegister:selected.offset,globalBestRegister:best.offset,
   equivalentRegisters:ties.map(r=>({offset:r.offset,pairs:r.pairs})),ambiguous:ties.length>0,feasibility:state,
   mismatchRefs:selected.columns.filter(c=>['mismatch','abasic','unknown'].includes(c.kind)),
   intendedCoreCoverage:{a:coverage('a',design?.coreA),b:coverage('b',design?.coreB)},reasonCodes};
 }
 const strong=(length,gc)=>length>=6||length>=4&&gc>=2;
 function self(strand,requestedProfile=profile){
  if(requestedProfile!==profile)throw Error('Unsupported self-complementarity profile');
  const positions=strand.orderedPositions,n=positions.length;
  const hairpins=[],dimers=[];
  const ref={schema:'SelfResult/2',algorithmVersion,evidence:{tier:'heuristic',basis:'Continuous sequence screen'}};
  const finish=()=>({...ref,status:strand.topologyStatus==='resolved'?'resolved':'unresolved',
   reasonCodes:strand.diagnostics,totals:{hairpins:hairpins.length,dimers:dimers.length},
   truncated:{hairpins:hairpins.length>20,dimers:dimers.length>20},hairpins:hairpins.slice(0,20),dimers:dimers.slice(0,20)});
  if(!n)return finish();
  for(let i=0;i<n;i++)for(let j=i+4;j<n;j++){
   if(i>0&&j<n-1&&paired(classify(positions[i-1],positions[j+1])))continue;
   let l=i,r=j,gc=0;
   const pairs=[];
   while(r-l>=4&&paired(classify(positions[l],positions[r]))){
    pairs.push([l+1,r+1]);
    if(isGC(positions[l],positions[r]))gc++;
    l++;r--;
   }
   if(pairs.length<3)continue;
   hairpins.push({pairs,length:pairs.length,gc,loop:{start:l+1,end:r+1,length:r-l+1},
    near3Prime:n-j-1<=2,strong:strong(pairs.length,gc)});
  }
  hairpins.sort((a,b)=>b.length-a.length||b.gc-a.gc||a.loop.length-b.loop.length||a.pairs[0][0]-b.pairs[0][0]);
  for(let offset=1-n;offset<n;offset++){
   const result=align(positions,positions,offset);
   const runs=result.runs.filter(run=>run.length>=3).sort((a,b)=>b.length-a.length||b.gc-a.gc);
   if(!runs.length)continue;
   // Swap identical A and B copies. A register is unchanged, while individual runs may be mirror-equivalent.
   const run=runs[0];
   const match=result.pairs.filter(p=>p.a>=run.first.a&&p.a<=run.last.a);
   dimers.push({offset,score:result.score,length:run.length,gc:run.gc,strong:runs.some(r=>strong(r.length,r.gc)),
    near3Prime:match.some(p=>Math.max(p.a,p.b)>=n-2),pairs:match});
  }
  dimers.sort((a,b)=>b.length-a.length||b.gc-a.gc||b.score-a.score||a.offset-b.offset);
  return finish();
 }
 return {resolve,duplex,self,classify};
})();



