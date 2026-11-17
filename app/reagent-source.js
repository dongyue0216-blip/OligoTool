'use strict';
// UI adapter. Compatibility is evaluated by the reaction engine against the current substrate.
const ReagentSource=(()=>{
 function parseUpload(text,selectedFamily=null){
    try{return Reactions.v2.parseReagent(text,selectedFamily);}
    catch(error){
     if(!error.message.includes('芳香键请导出 Kekulé'))throw error;
     const localized=SmallFragmentDepictor.localizeAromaticBonds(text);
     if(!localized)throw error;
     const result=Reactions.v2.parseReagent(localized,selectedFamily);
     result.normalization={...result.normalization,aromatic_representation:{source_ctfile:text}};
     return result;
    }
 }
 function mount({input,file,language,family,substrate,invalidate,defaultSource='upload'}){
  const label=document.createElement('label'),source=document.createElement('select');
  const entryLabel=document.createElement('label'),entry=document.createElement('select');
  source.id=input.id+'Source';entry.id=input.id+'LibraryEntry';
  label.append(document.createTextNode(''),source);
  entryLabel.append(document.createTextNode(''),entry);
  file.before(label,entryLabel);
  let choices=new Map();
  const english=()=>language.value==='en';
  const text=(zh,en)=>english()?en:zh;
  function localize(){
   label.firstChild.nodeValue=UILanguage.text("reagent.source");
   entryLabel.firstChild.nodeValue=family()==null?UILanguage.text("choose.secondary.reagent"):UILanguage.text("compatible.reagent");
   const selected=source.value||defaultSource;
   source.replaceChildren(new Option(UILanguage.text("upload.mol.sdf"),'upload'),new Option(UILanguage.text("built.in.reaction.reagents"),'builtin'),new Option(UILanguage.text("user.library"),'user'));
   source.value=selected;
  }
  function refresh(enabled=true,visible=true){
   const upload=source.value==='upload';
   entryLabel.firstChild.nodeValue=family()==null?UILanguage.text("choose.secondary.reagent"):UILanguage.text("compatible.reagent");
   label.hidden=!visible;source.disabled=!enabled||!visible;
   entryLabel.hidden=!visible||upload;entry.disabled=!enabled||entryLabel.hidden;
   input.hidden=file.hidden=!visible||!upload;
   input.disabled=file.disabled=!enabled||input.hidden;
   if(!visible||upload||!enabled)return;
   const selected=entry.value;
   const starting=substrate();
   choices=new Map(starting?Product.store.reagents(source.value,family(),starting).map(r=>[r.id,r]):[]);
   entry.replaceChildren(new Option(choices.size?UILanguage.text("select.reagent"):UILanguage.text("no.compatible.reagents"),''));
   for(const row of choices.values())entry.add(new Option(row.name,row.id));
   entry.value=choices.has(selected)?selected:'';
  }
  function graph(){
   if(source.value==='upload'){
    const text=input.value,selectedFamily=family();
    return parseUpload(text,selectedFamily);
   }
   const row=choices.get(entry.value);
   if(!row)throw Error(UILanguage.text("select.a.compatible.reagent"));
   return row.graph;
  }
  source.onchange=()=>{entry.value='';invalidate();};
  entry.onchange=invalidate;
  const refreshBuiltin=()=>{if(source.value==='builtin'&&!source.disabled&&!label.hidden)invalidate();};
  document.addEventListener('builtin-reagents-changed',refreshBuiltin);
  document.addEventListener('editable-chemistry-changed',()=>{if(source.value==='user'&&!source.disabled&&!label.hidden)invalidate();});
  window.addEventListener('storage',event=>{if(event.key===ChemistryLibrary.REAGENT_KEY)refreshBuiltin();});
  language.addEventListener('change',localize);
  localize();
  return {graph,refresh,hasSelection:()=>source.value==='upload'?!!input.value.trim():choices.has(entry.value),
   reset(){source.value=defaultSource;entry.value='';input.value='';file.value='';}};
 }
 return {mount,parseUpload};
})();
