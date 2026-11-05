 'use strict';
// B: independent analysis panel; no implicit Annealing Operation or chemistry edits.
(()=>{
 const host=document.createElement('article');host.id='hybridizationAnalysis';
 host.innerHTML=`<h2>Hybridization Analysis v1 / 互补性分析</h2><p>仅分析序列互补与候选发夹，不预测真实退火稳定性、Tm 或 ΔG。输入均为 5′ → 3′。支持 A/C/G/U/T；修饰或未知输入保留并标记未解析。</p><label>Strand 1<textarea id="hybridStrand1" placeholder="AUGCCAUAGCUA"></textarea></label><label>Strand 2（可留空）<textarea id="hybridStrand2" placeholder="UAGCUAUGGCAU"></textarea></label><button id="hybridAnalyze">分析 / Analyze</button><button id="hybridExport" disabled>导出分析 JSON</button><p id="hybridSummary" role="status"></p><pre id="hybridResult" style="white-space:pre-wrap;max-height:32rem;overflow:auto"></pre>`;
 document.getElementById('sequenceWorkspace').append(host);const $=id=>document.getElementById(id);let result=null;
 function invalidate(){result=null;$('hybridExport').disabled=true;$('hybridResult').textContent='';$('hybridSummary').textContent='';}
 for(const id of ['hybridStrand1','hybridStrand2'])$(id).addEventListener('input',invalidate);
 function describe(r){
  if(r.status==='unresolved')return r.strands.flatMap(s=>s.chemistryResolution.unresolved.map(u=>`${s.id} · position ${u.position+1}: ${u.reason}`)).join('\n');
  const lines=[];for(const d of r.duplexAnalyses){
   const a=r.strands.find(s=>s.id===d.strandIds[0]),b=r.strands.find(s=>s.id===d.strandIds[1]);
   lines.push(`${a.id} 5′ ${d.columns.map(c=>a.residues[c.a.residueIndex].baseIdentity).join('')} 3′`, `              ${d.columns.map(c=>c.complementary?'|':'.').join('')}`,`${b.id} 3′ ${d.columns.map(c=>b.residues[c.b.residueIndex].baseIdentity).join('')} 5′`, `Paired: ${d.pairedCount} / ${d.columns.length} aligned positions (${d.pairedPercentage.toFixed(1)}%)`, `Mismatches: ${d.mismatches.length} · longest continuous run: ${d.longestContinuousComplementaryRun}`, 'Internal bulges: not modeled',...d.overhangs.map(o=>`${o.strandId} overhang positions (1-based): ${o.residueIndices.map(i=>i+1).join(', ')||'none'}`),'Paired-base map (1-based): '+d.pairedBaseMap.map(([x,y])=>`${x.residueIndex+1} ↔ ${y.residueIndex+1}`).join(', '),'');
  }
  for(const self of r.selfAnalyses){lines.push(`${self.strandId}: ${self.candidateCount} hairpin candidates (not folding prediction)`);for(const c of self.candidates.slice(0,10))lines.push(`Stem: ${c.pairedCount} pairs · loop: ${c.loop.start+1}–${c.loop.end+1} · pairs: ${c.pairedBaseMap.map(([x,y])=>`${x.residueIndex+1} ↔ ${y.residueIndex+1}`).join(', ')}`);if(self.candidateCount>10)lines.push('First 10 shown; export contains up to 100 candidates.');}
  return lines.join('\n');
 }
 $('hybridAnalyze').onclick=()=>{invalidate();try{const strands=[{id:'strand-1',sequence:$('hybridStrand1').value}];if($('hybridStrand2').value.trim())strands.push({id:'strand-2',sequence:$('hybridStrand2').value});result=Hybridization.analyze({strands});$('hybridSummary').textContent=result.status==='unresolved'?'存在未解析化学；未执行配对分析。':result.duplexAnalyses.length?`${result.duplexAnalyses[0].pairedCount} pairs · ${result.duplexAnalyses[0].pairedPercentage.toFixed(1)}% of aligned overlap · longest run ${result.duplexAnalyses[0].longestContinuousComplementaryRun} · internal bulges not modeled`:`${result.selfAnalyses[0].candidateCount} hairpin candidates (not folding prediction)`;$('hybridResult').textContent=describe(result);$('hybridExport').disabled=false;}catch(e){$('hybridSummary').textContent=e.message;}};
 $('hybridExport').onclick=()=>{if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='hybridization-analysis.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
})();
