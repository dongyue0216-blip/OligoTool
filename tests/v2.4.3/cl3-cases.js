async()=>{
 const $=id=>document.getElementById(id),tests=[];
 const check=(name,pass)=>tests.push({name,pass:!!pass});
 const click=id=>$(id).click();
 const symbols=()=>[...document.querySelectorAll('#library .chemistry-entry')].map(n=>n.dataset.symbol);
 const choose=s=>document.querySelectorAll('#library .chemistry-entry').forEach(n=>{if(n.dataset.symbol===s)n.querySelector('button').click();});
 const cat=k=>document.querySelector('[data-category="'+k+'"]').click();
 const search=q=>{$('librarySearch').value=q;$('librarySearch').dispatchEvent(new Event('input'));};
 const lang=v=>{$('language').value=v;$('language').dispatchEvent(new Event('change',{bubbles:true}));};
 Workspaces.show('custom');click('libraryTab-builtin');
 const catalog=Product.store.builtinCatalog(),counts=[];
 for(const node of [...$('libraryCategories').querySelectorAll('button')]){
  const key=node.dataset.category;cat(key);const actual=symbols();
  const expected=catalog.filter(r=>String(r.category||r.family||r.type||'Other')===key).map(r=>r.symbol);
  check('Category coverage '+key,JSON.stringify(actual)===JSON.stringify(expected));
  for(const symbol of actual){choose(symbol);check('Inspector '+symbol,$('compoundInspector').querySelector('code')?.textContent===symbol);}
  counts.push({category:key,count:actual.length,members:actual});
 }
 check('Unique complete coverage',counts.reduce((s,c)=>s+c.count,0)===catalog.length&&new Set(counts.flatMap(c=>c.members)).size===catalog.length);
 for(const [key,required] of [['RNA',['rA','rC','rG','rU']],['F',['fA','fC','fG','fU']],['MOE',['eA','eC','eG','eU']],['DNA',['dA','dC','dG','dT']]]){cat(key);check('Required '+key,required.every(s=>symbols().includes(s)));}
 cat('RNA');choose('rC');search('fA');check('Cross category fA',symbols().includes('fA'));choose('fA');check('Search Inspector fA',$('compoundInspector').querySelector('code').textContent==='fA');search('');check('Restore browse state',symbols().includes('rA')&&$('compoundInspector').querySelector('code').textContent==='rC');
 click('libraryTab-custom');check('Custom compact list',$('libraryCategories').hidden);click('libraryTab-builtin');check('Builtin state restored',$('compoundInspector').querySelector('code').textContent==='rC');
 for(const l of ['en','zh-CN']){lang(l);cat('F');choose('fG');check('Language '+l,$('compoundInspector').querySelector('code').textContent==='fG'&&$('libraryCategories').textContent.includes('2′-F'));}
 search('totally-no-match');check('No match',symbols().length===0);search('');cat('RNA');choose('rA');lang('en');
 check('file protocol',location.protocol==='file:');check('Desktop no overflow',document.documentElement.scrollWidth<=innerWidth);
 return {tests,pass:tests.filter(t=>t.pass).length,total:tests.length,totalEntries:catalog.length,categories:counts};
}


