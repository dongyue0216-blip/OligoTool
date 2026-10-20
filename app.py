import html
import pandas as pd
import streamlit as st
import streamlit.components.v1 as components
from rdkit.Chem import Draw
from chemistry import parse_formula
from structure_builder import structure_properties, readable_structure_properties, readable_structure_svg, readable_structure_cdxml, StructureNotSupportedError
from validation import validate_sequence
from photometry import od260_properties, ODNotSupportedError
from custom_library import (load_library, mol_from_input, properties as custom_properties, add_entry, delete_entry,
                            CATEGORIES, atom_options, detect_attachment_markers, strip_attachment_markers)
from rdkit import Chem

st.set_page_config(page_title="Oligo Chemistry Toolkit v1.0.0", layout="wide")
st.markdown("""<style>
html, body, [class*="css"] { font-size: 16px; }
.stMarkdown, .stCaption, .stTextInput, .stMetric { font-size: 16px; }
[data-testid="stMetricValue"] { font-size: 1.55rem; }
</style>""", unsafe_allow_html=True)

LANG = {
"English": {
"title":"Oligo Chemistry Toolkit v1.0.0","cap":"Sequence → continuous, regularized oligo structure + ChemDraw export",
"notation":"Notation","lang":"Language / 语言","tol":"Validation tolerance (Da)","seq":"Sequence (5' → 3')",
"readable":"Continuous oligo structure","readcap":"Ten residues per column, aligned at the top, read 5′→3′ down each column and then to the right. Routed connections join columns.",
"full":"Complete atomic structure","fullcap":"This is the continuous atom-level molecular graph used for chemical validation. For long sequences it is intentionally secondary to the readable layout above.",
"formula":"Molecular formula","exact":"Exact mass","avg":"Average MW","pass":"3-way validation PASS — direct sequence calculation, component assembly, and atomic molecular graph agree.",
"fail":"VALIDATION FAIL — do not use this result until the sequence/chemistry definition is reviewed.","details":"Validation details","export":"Structure export",
"mol":"Download MOL","sdf":"Download SDF","cdxml":"Download ChemDraw (CDXML)","exportcap":"MOL/SDF preserve the real graph with standard straight bonds; visual bends are shown in the preview and CDXML. CDXML opens as an editable ChemDraw drawing. Rp/Sp phosphorus stereochemistry is unspecified.",
"smiles":"SMILES","parsed":"Parsed sequence","empty":"Enter a sequence above.","invalid":"Invalid sequence","genfail":"Structure generation failed",
"position":"Position","residue":"Residue","sugar":"Sugar","base":"Base","link":"Linkage to next","path":"Path","mass":"Exact mass (Da)","delta":"Graph vs engine Δ",
"direct":"A — direct sequence","assembly":"B — base/sugar/backbone assembly","graph":"C — RDKit atomic graph","perrow":"Residues per row",
"od":"OD260 / extinction coefficient","eps":"ε260","nmolod":"nmol / OD260","ugod":"µg / OD260","odmethod":"OD260 method","odnote":"OD260 note","odapprox":"Estimated: modified/mixed sugars use the parent RNA base nearest-neighbor values. Base-changing chromophores need their own ε260 correction.","odexact":"Canonical nearest-neighbor calculation.","valsummary":"3-way validation"},
"中文": {
"title":"Oligo Chemistry Toolkit v1.0.0","cap":"序列 → 连续规整的寡核苷酸化学结构 + ChemDraw 导出",
"notation":"输入规则","lang":"语言 / Language","tol":"验证质量容差 (Da)","seq":"序列（5' → 3'）",
"readable":"连续规整寡核苷酸结构","readcap":"每 10 个残基一列，各列顶部对齐；沿每列从上到下按 5′→3′ 阅读，再向右进入下一列。跨列连接使用避让折线。",
"full":"完整原子级化学结构","fullcap":"这是用于化学验证的连续原子级 molecular graph。长序列时，建议以上面的规整排版作为主要阅读视图。",
"formula":"分子式","exact":"单同位素精确质量","avg":"平均分子量","pass":"三重验证通过 — 序列直接计算、组分组装和原子级 molecular graph 三条路径一致。",
"fail":"验证失败 — 在检查序列或化学定义之前，请勿使用该结果。","details":"验证详情","export":"结构文件导出",
"mol":"下载 MOL","sdf":"下载 SDF","cdxml":"下载 ChemDraw (CDXML)","exportcap":"MOL/SDF 保留真实原子图和标准直线键；预览及 CDXML 显示跨列折线。CDXML 可直接用 ChemDraw 打开并编辑。Rp/Sp 磷手性目前不指定。",
"smiles":"SMILES","parsed":"序列解析结果","empty":"请在上方输入序列。","invalid":"无效序列","genfail":"结构生成失败",
"position":"位置","residue":"残基","sugar":"糖类型","base":"碱基","link":"连接到下一位","path":"计算路径","mass":"精确质量 (Da)","delta":"原子图与计算引擎差值",
"direct":"A — 序列直接计算","assembly":"B — 碱基/糖/骨架组装","graph":"C — RDKit 原子图","perrow":"每行核苷酸数",
"od":"OD260 / 消光系数","eps":"ε260","nmolod":"nmol / OD260","ugod":"µg / OD260","odmethod":"OD260 计算方法","odnote":"OD260 说明","odapprox":"估算值：修饰/混合糖型暂按对应 RNA 碱基的 nearest-neighbor 参数计算；会改变发色团的碱基修饰需要单独的 ε260 修正。","odexact":"标准 nearest-neighbor 计算。","valsummary":"三重验证"}
}

with st.sidebar:
    language = st.radio("Language / 语言", ["中文", "English"], horizontal=True)
T=LANG[language]

page = st.sidebar.radio("功能 / Page", ["计算器 / Calculator", "自定义化学库 / Custom Chemistry"], index=0)
if page.startswith("自定义"):
    st.title("自定义化学库" if language=="中文" else "Custom Chemistry Library")
    st.caption("支持连接到真实 O 的 ChemDraw 5/3 末端标签。SDF 仅接受单分子。上传 MOL/SDF 或粘贴 SMILES。推荐在 ChemDraw 中把 5′、3′ 两个连接端的末端标记原子分别标成 5 和 3；程序会自动识别并移除标记。" if language=="中文" else "Import MOL/SDF or paste SMILES. Recommended: label the two terminal attachment marker atoms 5 and 3 in ChemDraw; they will be detected and removed automatically.")
    left,right=st.columns([1,1])
    with left:
        code=st.text_input("代码 / Code", placeholder="例如 xG")
        name=st.text_input("名称 / Name")
        category=st.selectbox("类型 / Category", CATEGORIES)
        smiles=st.text_area("SMILES", height=90)
        up=st.file_uploader("上传 MOL / SDF", type=["mol","sdf"])
        notes=st.text_area("备注 / Notes", height=70)
        if st.button("读取并预览 / Read & Preview", use_container_width=True):
            try:
                m=mol_from_input(smiles, up.getvalue() if up else None, up.name if up else "")
                st.session_state["custom_preview_molblock"]=Chem.MolToMolBlock(m)
            except Exception as exc: st.error(str(exc))
    with right:
        mb=st.session_state.get("custom_preview_molblock")
        if mb:
            m=Chem.MolFromMolBlock(mb, sanitize=True, removeHs=False)
            display_m=m
            if category=="Residue":
                try:
                    display_m,_,_=strip_attachment_markers(m)
                except ValueError:
                    pass  # The attachment panel below presents the specific error.
            pp=custom_properties(display_m)
            dopts=Draw.MolDrawOptions(); dopts.addAtomIndices=True; dopts.baseFontSize=0.75
            st.image(Draw.MolToImage(display_m,size=(560,400),options=dopts), caption="原子编号用于指定连接位点 / Atom indices for attachment points")
            a,b,c=st.columns(3); a.metric("Formula",pp["formula"]); b.metric("Exact mass",f"{pp['exact_mass']:.6f}"); c.metric("Average MW",f"{pp['average_mw']:.3f}")
            st.code(pp["smiles"], language=None)
            att5=att3=None
            save_mol=m
            if category=="Residue":
                st.markdown("**连接位点 / Attachment points**")
                marker_error=None
                try:
                    marks=detect_attachment_markers(m)
                    if marks and set(marks)!={3,5}: raise ValueError("Incomplete 5/3 attachment marker pair; correct the labels before saving.")
                except Exception as exc:
                    marks={}; marker_error=str(exc); st.error(marker_error)
                if set(marks)=={3,5} and not marker_error:
                    try:
                        save_mol,att5,att3=strip_attachment_markers(m)
                    except ValueError as exc:
                        st.error(str(exc)); st.stop()
                    st.success("已自动识别 ChemDraw 的 5 / 3 端标记。保存时标记会被移除，只保留真实单体结构。" if language=="中文" else "ChemDraw 5 / 3 terminal markers detected automatically. Markers are removed on save; only the real residue is stored.")
                    st.success(f"5' attachment detected: O atom {att5} / 3' attachment detected: O atom {att3} (saved scaffold indices)")
                elif not marker_error:
                    st.caption("未检测到一对 5/3 端标记。你仍可使用下面的原子编号作为备用方式。注意：仅用 Text 工具写在键旁的文字不会保存在 MOL/SDF 分子图中。" if language=="中文" else "No complete 5/3 marker pair detected. Atom-number selection remains available as a fallback. Text annotations placed beside a bond are not stored in the MOL/SDF molecular graph.")
                    opts=atom_options(m); labels={i:t for i,t in opts}; ids=[i for i,_ in opts]
                    q1,q2=st.columns(2)
                    att5=q1.selectbox("5′ 连接原子 / 5′ atom",ids,format_func=lambda i:labels[i],key="att5")
                    att3=q2.selectbox("3′ 连接原子 / 3′ atom",ids,index=min(1,len(ids)-1),format_func=lambda i:labels[i],key="att3")
                    if att5==att3: st.warning("5′ 与 3′ 连接原子不能相同。 / 5′ and 3′ atoms must differ.")
            elif category=="Linkage":
                st.info("特殊 Linkage 的图形化拼接将在下一步采用两端 dummy attachment atoms（[*:1] / [*:2]）方案；本版先开放 Residue 的完整接入，避免错误价态。" if language=="中文" else "Custom linkage assembly will use two dummy attachment atoms ([*:1]/[*:2]) in the next step. This release enables complete Residue integration first to avoid invalid valence guesses.")
            if st.button("保存到本地化学库 / Save", type="primary", use_container_width=True):
                try:
                    if category=="Residue" and marker_error: raise ValueError(marker_error)
                    if category=="Residue" and att5==att3: raise ValueError("5′ and 3′ attachment atoms must be different.")
                    add_entry(code,name,category,save_mol,notes,att5,att3); st.success("已保存 / Saved"); st.session_state.pop("custom_preview_molblock",None); st.rerun()
                except Exception as exc: st.error(str(exc))
    st.divider(); st.subheader("已保存结构 / Saved structures")
    rows=load_library()
    if not rows: st.info("尚未保存自定义结构 / No custom structures saved yet.")
    else:
        for r in rows:
            c1,c2,c3,c4,c5=st.columns([1,2,1.4,1.4,0.8])
            c1.write(f"**{r['code']}**"); c2.write(r['name']); c3.write(r['category']); c4.write(f"{r['formula']}  ·  {r['exact_mass']:.4f} Da" + (f" · 5′:{r.get('attachment_5')} / 3′:{r.get('attachment_3')}" if r.get('category')=='Residue' and r.get('attachment_5') is not None else ""))
            if c5.button("删除", key=f"del_{r['code']}"):
                delete_entry(r['code']); st.rerun()
    st.info("Residue：保存 5′/3′ 连接原子后，Code 已可直接参与序列解析、分子量计算和完整结构拼接。特殊 Linkage 将在后续用 dummy attachment atoms 接入。" if language=="中文" else "Residues saved with 5′/3′ attachment atoms can now be used directly in sequence parsing, mass calculation and full-structure assembly. Custom linkages will follow using dummy attachment atoms.")
    st.stop()

st.title(T["title"]); st.caption("Oligo Chemistry Toolkit v1.0.0")
tolerance=0.00001
with st.sidebar.expander("Notation Guide / Help", expanded=False):
    st.markdown("**DNA:** `A C G T` · **RNA:** `rA rC rG rU`")
    st.markdown("**Sugars:** F `f` · OMe `m` · MOE `e` · LNA `l` · UNA `u`; e.g. `fA*fCrGmU`.")
    st.markdown("**Backbone:** PO no symbol · PS `*` · PS2 `**` · MsPA `&`.")
    st.markdown("**Inosine:** `rI`, `fI`, `mI`, `eI`, `lI`, `uI`.")
    st.markdown("**Terminals:** `(P)rArUrG` / `(PP)rArUrG` for 5′; `rArUrG(P)` / `rArUrG(PP)` for 3′.")

sequence=st.text_input(T["seq"],value="fA*fCrGmU").strip()

if sequence:
    result=validate_sequence(sequence,mass_tolerance_da=tolerance)
    if result["status"]=="INVALID": st.error(f"{T['invalid']}: {result['message']}"); st.stop()
    structural=result['structural']; direct=result['direct']; residues=result['parsed_residues']; linkages=result['parsed_linkages']
    try:
        graph=readable_structure_properties(sequence); svg,svg_width=readable_structure_svg(sequence)
        formula_ok=parse_formula(graph['formula'])==parse_formula(structural['formula']); graph_mass_error=abs(graph['exact_mass']-structural['exact_mass']); graph_ok=formula_ok and graph_mass_error<=tolerance
    except Exception as exc: st.error(f"{T['genfail']}: {exc}"); st.stop()

    c1,c2,c3=st.columns(3); c1.metric(T["formula"],structural['formula']); c2.metric(T["exact"],f"{structural['exact_mass']:.6f} Da"); c3.metric(T["avg"],f"{structural['average_mw']:.3f} g/mol")
    with st.expander(T["valsummary"], expanded=False):
        st.success(T["pass"]) if result['valid'] and graph_ok else st.error(T["fail"])
        comparison=pd.DataFrame([{T['path']:T['direct'],T['formula']:direct['formula'],T['mass']:direct['exact_mass']},{T['path']:T['assembly'],T['formula']:structural['formula'],T['mass']:structural['exact_mass']},{T['path']:T['graph'],T['formula']:graph['formula'],T['mass']:graph['exact_mass']}]); st.dataframe(comparison,use_container_width=True,hide_index=True); st.write(f"{T['delta']}: **{graph_mass_error:.10f} Da**")

    try:
        odp=od260_properties(sequence, structural['average_mw'])
        st.subheader(T["od"])
        o1,o2,o3=st.columns(3)
        o1.metric(T["eps"], f"{odp['epsilon260']:,.0f} L·mol⁻¹·cm⁻¹")
        o2.metric(T["nmolod"], f"{odp['nmol_per_od']:.3f}")
        o3.metric(T["ugod"], f"{odp['ug_per_od']:.3f}")
        with st.expander(T["odnote"], expanded=False):
            st.write(T["odapprox"] if odp['estimated'] else T["odexact"])
            st.caption(odp['method'])
    except ODNotSupportedError as exc:
        st.info(f"{T['od']}: {exc}")
    st.subheader(T["readable"]); st.caption(T["readcap"])
    components.html(f'<div style="overflow:auto;width:100%;height:315px;background:white;border:1px solid #ddd;border-radius:10px;padding:4px"><div style="width:58%;min-width:520px">{svg}</div></div>',height=335,scrolling=False)

    st.subheader(T["export"]); b1,b2,b3=st.columns(3); safe=sequence.replace('*','PS').replace('&','MsPA')
    b1.download_button(T["mol"],graph['molblock'],file_name=f"{safe}.mol",mime="chemical/x-mdl-molfile",use_container_width=True); b2.download_button(T["sdf"],graph['sdf'],file_name=f"{safe}.sdf",mime="chemical/x-mdl-sdfile",use_container_width=True); b3.download_button(T["cdxml"],readable_structure_cdxml(sequence),file_name=f"{safe}.cdxml",mime="application/xml",use_container_width=True); st.caption(T["exportcap"])
    with st.expander(T["smiles"]): st.code(graph['smiles'],language=None)
    with st.expander(T["parsed"]):
        rows=[]
        for i,r in enumerate(residues): rows.append({T['position']:i+1,T['residue']:r['residue'],T['sugar']:r['sugar_name'],T['base']:r['base_name'],T['link']:linkages[i]['code'] if i<len(linkages) else '—'})
        from parser import parse_product_notation
        st.write({"terminal_entities": parse_product_notation(sequence)["terminals"]})
        st.dataframe(pd.DataFrame(rows),use_container_width=True,hide_index=True)
else: st.info(T["empty"])
