'use strict';
const ReactionFamilyWords={
 en:{cap:'CAP',condensation:'Amine Coupling',click:'Click Reaction',iedda:'IEDDA / Tetrazine Ligation',family:'Reaction family',starting:'Starting Molecule',secondary:'Secondary Reagent',product:'Product Preview',choose:'Choose a detected site',none:'No candidate sites',pair:'Compatible role assignment',confirm:'I have checked both highlighted sites',activation:'Formal product transformation — activation required experimentally',capHelp:'5′ phosphate + Im-m7GDP',input:'Secondary reagent · MOL / SDF',required:'Provide the secondary MolecularGraph to detect compatible sites.',unavailable:'Reaction Engine v2 is not connected. Integration Refresh is required.',stale:'Inputs or sites changed — preview again.',unsupported:'Unsupported',ready:'Inspect both highlighted sites before applying.',apply:'Apply Modification',preview:'Preview',next:'+ Add Next',atom:'atom',selectPair:'Choose a compatible pair',noPair:'No compatible role assignment',failed:'Reaction Engine returned an invalid site mapping.'},
 'zh-CN':{cap:'CAP',condensation:'胺偶联',click:'Click 反应',iedda:'IEDDA / 四嗪偶联',family:'反应家族',starting:'起始分子',secondary:'第二反应物',product:'产物预览',choose:'选择检测到的位点',none:'未检测到候选位点',pair:'兼容的角色分配',confirm:'我已确认双方高亮位点',activation:'理论产物变换 — 实验中需要活化',capHelp:'5′ 磷酸 + Im-m7GDP',input:'第二反应物 · MOL / SDF',required:'请提供第二反应物结构以检测兼容位点。',unavailable:'尚未连接 Reaction Engine v2；需要 Integration Refresh。',stale:'输入或位点已更改 — 请重新预览。',unsupported:'不支持',ready:'应用前请检查双方高亮位点。',apply:'应用修饰',preview:'预览',next:'+ 新增下一步',atom:'原子',selectPair:'选择兼容位点对',noPair:'没有兼容的角色分配',failed:'Reaction Engine 返回的位点映射无效。'}
};
Object.assign(ReactionFamilyWords.en,{
 carbonate:'Activated carbonate',
 previewReady:'Preview ready. Apply Modification saves a checkpoint.',applied:'Checkpoint saved. Export or Add Next.',
 'motif.sulfo-NHS':'Sulfo-NHS ester','atom.proximal':'proximal','atom.middle':'middle','atom.distal':'distal','atom.p':'phosphate','atom.o':'oxygen',
 isomer:'Explicit regioisomer',
 'motif.primary_amine':'Primary amine','motif.secondary_amine':'Secondary amine','motif.NHS':'NHS ester','motif.sulfo_NHS':'Sulfo-NHS ester','motif.PFP':'PFP ester','motif.TFP':'TFP ester','motif.pNP':'p-Nitrophenyl ester','motif.carboxylic_acid':'Carboxylic acid','motif.azide':'Azide','motif.alkyne':'Ordinary terminal alkyne','motif.DBCO':'DBCO · strained alkyne','motif.BCN':'BCN · strained alkyne','motif.Im-m7GDP':'Im-m7GDP','motif.terminalPhosphateNucleophile':'5′ terminal phosphate',
 'atom.n':'','atom.carbonyl':'carbonyl','atom.leavingO':'leaving','atom.terminal':'','atom.internal':'',
 'role.amine':'Amine','role.acylDonor':'Acyl donor','role.azide':'Azide','role.alkyne':'Ordinary alkyne','role.strainedAlkyne':'Strained alkyne','role.terminalPhosphateNucleophile':'5′ phosphate','role.m7GDPImidazolide':'Im-m7GDP'
});
Object.assign(ReactionFamilyWords['zh-CN'],{
 carbonate:'活性碳酸酯',
 previewReady:'预览完成；应用修饰后保存 checkpoint。',applied:'已保存 checkpoint；可导出或新增下一步。',
 'motif.sulfo-NHS':'Sulfo-NHS 活性酯','atom.proximal':'近端','atom.middle':'中间','atom.distal':'远端','atom.p':'磷酸','atom.o':'氧',
 isomer:'明确选择区域异构体',
 'motif.primary_amine':'伯胺','motif.secondary_amine':'仲胺','motif.NHS':'NHS 活性酯','motif.sulfo_NHS':'Sulfo-NHS 活性酯','motif.PFP':'PFP 活性酯','motif.TFP':'TFP 活性酯','motif.pNP':'对硝基苯酚酯','motif.carboxylic_acid':'羧酸','motif.azide':'叠氮','motif.alkyne':'普通末端炔','motif.DBCO':'DBCO · 张力炔','motif.BCN':'BCN · 张力炔','motif.Im-m7GDP':'Im-m7GDP','motif.terminalPhosphateNucleophile':'5′ 末端磷酸',
 'atom.n':'','atom.carbonyl':'羰基','atom.leavingO':'离去','atom.terminal':'','atom.internal':'',
 'role.amine':'胺','role.acylDonor':'酰基供体','role.azide':'叠氮','role.alkyne':'普通炔','role.strainedAlkyne':'张力炔','role.terminalPhosphateNucleophile':'5′ 磷酸','role.m7GDPImidazolide':'Im-m7GDP'
});

Object.assign(ReactionFamilyWords.en,{reduction:'Disulfide Reduction',maleimide:'Thiol–Maleimide',reductionHelp:'Cleave the selected S–S bond; retain the oligo-containing fragment when provenance is unambiguous.',retainRequired:'Choose the fragment to retain. Its atoms are highlighted; fragment size does not select the product.',retain:'Retain fragment',atoms:'atoms','role.disulfide':'Disulfide','role.thiol':'Thiol','role.maleimide':'Maleimide','motif.disulfide':'Disulfide','motif.thiol':'Thiol','motif.maleimide':'Maleimide','motif.phosphoroimidazolide':'Activated diphosphate P–N imidazole'});
Object.assign(ReactionFamilyWords['zh-CN'],{reduction:'二硫键还原',maleimide:'巯基–马来酰亚胺',reductionHelp:'切断所选 S–S 键；来源明确时自动保留含 oligo 的片段。',retainRequired:'请选择保留片段；其原子将高亮。不会仅按大小自动选择。',retain:'保留片段',atoms:'原子','role.disulfide':'二硫键','role.thiol':'巯基','role.maleimide':'马来酰亚胺','motif.disulfide':'二硫键','motif.thiol':'巯基','motif.maleimide':'马来酰亚胺','motif.phosphoroimidazolide':'活化二磷酸 P–N 咪唑'});
Object.assign(ReactionFamilyWords.en,{confirmSingle:'I have checked the S–S bond and retained fragment',readySingle:'Inspect the highlighted S–S site and retained fragment before applying.',retentionPair:'S–S site / retained fragment','atom.s1':'','atom.s2':''});
Object.assign(ReactionFamilyWords['zh-CN'],{confirmSingle:'我已确认二硫键及保留片段',readySingle:'应用前请检查高亮二硫键和保留片段。',retentionPair:'二硫键 / 保留片段','atom.s1':'','atom.s2':''});
Object.assign(ReactionFamilyWords.en,{capHelp:'Compatible terminal P–O site + activated GDP/m7GDP P–N imidazole · structural compatibility only; experimental process validation not established','atom.alpha':'α','atom.beta':'β'});
Object.assign(ReactionFamilyWords['zh-CN'],{capHelp:'兼容末端 P–O 位点 + GDP/m7GDP 活化 P–N 咪唑 · 仅表示结构兼容，实验工艺验证尚未确立','atom.alpha':'α','atom.beta':'β'});
