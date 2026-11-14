# -*- coding: utf-8 -*-
"""生成 BOSS 端数据库第一阶段范围评审 Word 文档。"""

from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


NAVY = RGBColor(0x1F, 0x3A, 0x5F)
BLUE = RGBColor(0x2E, 0x74, 0xB5)
GRAY = RGBColor(0x59, 0x59, 0x59)
LIGHT_GRAY = "F2F2F2"
HEADER_FILL = "1F3A5F"
ALT_FILL = "F2F6FC"
CALLOUT_YELLOW = "FFF4E5"
CALLOUT_YELLOW_BORDER = "F4B183"
CALLOUT_BLUE = "EAF2FB"
CALLOUT_BLUE_BORDER = "9DC3E6"

EAST_ASIA_FONT = "Microsoft YaHei"
BODY_FONT = "Microsoft YaHei"
MONO_FONT = "Consolas"


def set_run_font(run, name=BODY_FONT, size=None, bold=None, color=None):
    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.get_or_add_rFonts()
    rfonts.set(qn("w:ascii"), name)
    rfonts.set(qn("w:hAnsi"), name)
    rfonts.set(qn("w:eastAsia"), EAST_ASIA_FONT if name != MONO_FONT else MONO_FONT)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color is not None:
        run.font.color.rgb = color


def style_paragraph(paragraph, space_before=0, space_after=4, line_spacing=1.35, align=None):
    pf = paragraph.paragraph_format
    pf.space_before = Pt(space_before)
    pf.space_after = Pt(space_after)
    pf.line_spacing = line_spacing
    if align is not None:
        paragraph.alignment = align


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_cell_margins(cell, top=90, left=110, bottom=90, right=110):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for tag, value in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        node = tc_mar.find(qn(f"w:{tag}"))
        if node is None:
            node = OxmlElement(f"w:{tag}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table, color="D9E2F3", size="4"):
    tbl_pr = table._tbl.tblPr
    old = tbl_pr.find(qn("w:tblBorders"))
    if old is not None:
        tbl_pr.remove(old)
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = OxmlElement(f"w:{edge}")
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)
        borders.append(element)
    tbl_pr.append(borders)


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def prevent_row_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    tr_pr.append(OxmlElement("w:cantSplit"))


def set_col_widths(table, widths):
    table.autofit = False
    table.width = sum(widths, Cm(0))
    tbl_pr = table._tbl.tblPr
    if tbl_pr.find(qn("w:tblLayout")) is None:
        layout = OxmlElement("w:tblLayout")
        layout.set(qn("w:type"), "fixed")
        tbl_pr.append(layout)
    for index, width in enumerate(widths):
        table.columns[index].width = width
    for row in table.rows:
        for index, width in enumerate(widths):
            row.cells[index].width = width


def clear_cell(cell):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.15


def write_cell(cell, lines, size=9, bold=False, color=None, align=WD_ALIGN_PARAGRAPH.LEFT):
    """lines 可以是字符串或字符串列表；列表表示多个段落。"""
    clear_cell(cell)
    if isinstance(lines, str):
        lines = [lines]
    for index, line in enumerate(lines):
        p = cell.paragraphs[0] if index == 0 else cell.add_paragraph()
        p.alignment = align
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.15
        run = p.add_run(line)
        set_run_font(run, BODY_FONT, size, bold, color)


def add_heading(doc, text, level=1):
    p = doc.add_paragraph()
    style_paragraph(p, space_before=14 if level == 1 else 9, space_after=6, line_spacing=1.2)
    run = p.add_run(text)
    set_run_font(run, BODY_FONT, 15 if level == 1 else 11.5, True, NAVY if level == 1 else BLUE)
    if level == 1:
        pPr = p._p.get_or_add_pPr()
        pBdr = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), "6")
        bottom.set(qn("w:space"), "3")
        bottom.set(qn("w:color"), "9DC3E6")
        pBdr.append(bottom)
        pPr.append(pBdr)
    return p


def add_body(doc, text, size=10.5, color=None, bold=False, space_after=4):
    p = doc.add_paragraph()
    style_paragraph(p, space_before=0, space_after=space_after, line_spacing=1.4)
    run = p.add_run(text)
    set_run_font(run, BODY_FONT, size, bold, color)
    return p


def add_bullet(doc, text, level=0, size=10.5):
    p = doc.add_paragraph(style="List Bullet" if level == 0 else "List Bullet 2")
    style_paragraph(p, space_before=0, space_after=2, line_spacing=1.3)
    run = p.add_run(text)
    set_run_font(run, BODY_FONT, size, False, None)
    return p


def add_callout(doc, title, body, fill, border):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    set_table_borders(table, color=border, size="6")
    cell = table.cell(0, 0)
    set_cell_shading(cell, fill)
    set_cell_margins(cell, top=130, left=170, bottom=130, right=170)
    clear_cell(cell)

    p1 = cell.paragraphs[0]
    p1.paragraph_format.space_after = Pt(3)
    r1 = p1.add_run(title)
    set_run_font(r1, BODY_FONT, 10.5, True, NAVY)

    p2 = cell.add_paragraph()
    p2.paragraph_format.space_before = Pt(0)
    p2.paragraph_format.space_after = Pt(0)
    p2.paragraph_format.line_spacing = 1.35
    r2 = p2.add_run(body)
    set_run_font(r2, BODY_FONT, 9.5, False, GRAY)


def add_caption(doc, text):
    p = doc.add_paragraph()
    style_paragraph(p, space_before=4, space_after=3, line_spacing=1.2)
    run = p.add_run(text)
    set_run_font(run, BODY_FONT, 8.5, False, GRAY)
    return p


def add_page_field(paragraph, instr):
    run = paragraph.add_run()
    set_run_font(run, BODY_FONT, 8, False, GRAY)
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr_el = OxmlElement("w:instrText")
    instr_el.set(qn("xml:space"), "preserve")
    instr_el.text = instr
    sep = OxmlElement("w:fldChar")
    sep.set(qn("w:fldCharType"), "separate")
    txt = OxmlElement("w:t")
    txt.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr_el)
    run._r.append(sep)
    run._r.append(txt)
    run._r.append(end)


def build_header_footer(section):
    header = section.header
    header.is_linked_to_previous = False
    hp = header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hp.paragraph_format.space_after = Pt(0)
    hr = hp.add_run("简历筛选平台 · BOSS 端数据库第一阶段评审")
    set_run_font(hr, BODY_FONT, 8, False, GRAY)

    footer = section.footer
    footer.is_linked_to_previous = False
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fp.paragraph_format.space_before = Pt(0)
    fp.paragraph_format.space_after = Pt(0)
    r1 = fp.add_run("内部评审稿 · 第 ")
    set_run_font(r1, BODY_FONT, 8, False, GRAY)
    add_page_field(fp, "PAGE")
    r2 = fp.add_run(" 页 / 共 ")
    set_run_font(r2, BODY_FONT, 8, False, GRAY)
    add_page_field(fp, "NUMPAGES")
    r3 = fp.add_run(" 页")
    set_run_font(r3, BODY_FONT, 8, False, GRAY)


def build_document():
    doc = Document()
    doc.core_properties.title = "BOSS 端数据库第一阶段范围评审"
    doc.core_properties.subject = "简历筛选平台 MySQL 数据库第一阶段表范围与删减建议"
    doc.core_properties.author = "AI 产品经理 / 全栈架构师"
    doc.core_properties.comments = "用于功能删减确认，不用于建库执行。"

    # 默认样式
    normal = doc.styles["Normal"]
    normal.font.name = BODY_FONT
    normal.font.size = Pt(10.5)
    normal.element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:eastAsia"), EAST_ASIA_FONT)
    normal.paragraph_format.line_spacing = 1.4
    normal.paragraph_format.space_after = Pt(4)

    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.8)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)
    section.header_distance = Cm(0.9)
    section.footer_distance = Cm(0.9)
    build_header_footer(section)

    # 标题区
    p = doc.add_paragraph()
    style_paragraph(p, space_before=4, space_after=2, line_spacing=1.1)
    r = p.add_run("BOSS 端数据库 · 第一阶段范围评审")
    set_run_font(r, BODY_FONT, 22, True, NAVY)

    p = doc.add_paragraph()
    style_paragraph(p, space_before=0, space_after=10, line_spacing=1.2)
    r = p.add_run("MySQL 8.0 / 10 张候选表 / 请你做功能删减")
    set_run_font(r, BODY_FONT, 11, False, GRAY)

    # 文档信息
    info = doc.add_table(rows=5, cols=2)
    info.alignment = WD_TABLE_ALIGNMENT.CENTER
    info.autofit = False
    set_col_widths(info, [Cm(4.0), Cm(13.0)])
    set_table_borders(info, color="D9E2F3", size="4")
    info_data = [
        ("文档版本", "v0.1 评审稿"),
        ("数据库", "resume_screening（MySQL 8.0）"),
        ("当前设计", "10 张表（完整版）"),
        ("推荐第一阶段", "7 张表（方案 B：5 张核心表 + 状态流水 + AI 结果）"),
        ("文档状态", "待你删减确认；确认前不建库"),
    ]
    for i, (key, value) in enumerate(info_data):
        c0, c1 = info.rows[i].cells
        set_cell_margins(c0, top=80, left=120, bottom=80, right=100)
        set_cell_margins(c1, top=80, left=120, bottom=80, right=100)
        set_cell_shading(c0, "EAF2FB")
        write_cell(c0, key, size=9, bold=True, color=NAVY)
        write_cell(c1, value, size=9, color=GRAY)
        prevent_row_split(info.rows[i])

    doc.add_paragraph().paragraph_format.space_after = Pt(2)

    add_callout(
        doc,
        "先不要建库",
        "这份文档只用于确认第一阶段范围。你删减后，我再同步 SQL；确认前我不会连接数据库、不会执行脚本。",
        CALLOUT_YELLOW,
        CALLOUT_YELLOW_BORDER,
    )
    doc.add_paragraph().paragraph_format.space_after = Pt(1)
    add_callout(
        doc,
        "我的建议：方案 B（7 张表）",
        "先保留 5 张核心表 + 状态流水 + AI 结果表；skills、job_skills、resume_skills 三张技能表后置。"
        "第一阶段 SQL 硬筛不依赖技能表，AI 可以直接读 JD 和简历原文；等真实数据证明“技能筛选”是高频需求，再加不迟。",
        CALLOUT_BLUE,
        CALLOUT_BLUE_BORDER,
    )

    # 1. 第一阶段边界
    add_heading(doc, "1. 第一阶段建议边界")
    add_body(
        doc,
        "本项目只有一个数据库 resume_screening；下面说的 10 个条目，是库里的 10 张表。"
        "第一阶段建议只做“BOSS 端发职位、C 端投简历、SQL 硬筛、AI 精筛”这一条闭环，其他能力先不铺开。",
    )
    scope = doc.add_table(rows=2, cols=2)
    scope.alignment = WD_TABLE_ALIGNMENT.CENTER
    scope.autofit = False
    set_col_widths(scope, [Cm(8.5), Cm(8.5)])
    set_table_borders(scope, color="D9E2F3", size="4")
    headers = [("建议做", "先不做")]
    for j, text in enumerate(headers[0]):
        cell = scope.cell(0, j)
        set_cell_shading(cell, HEADER_FILL)
        set_cell_margins(cell, top=90, left=120, bottom=90, right=120)
        write_cell(cell, text, size=9.5, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
    scope_rows = [
        (
            ["企业注册/登录、HR 账号", "职位发布/暂停/关闭", "简历录入", "投递 + 状态追踪", "SQL 硬筛（学历/经验/城市）", "AI 精筛（仅入围简历）"],
            ["面试、Offer、入职", "收藏、站内信、支付", "一个 HR 多企业、一人多份简历", "向量召回 / 复杂全文搜索", "复杂 RBAC、计费、配额"],
        )
    ]
    for i, (left, right) in enumerate(scope_rows, start=1):
        c0, c1 = scope.rows[i].cells
        set_cell_margins(c0, top=90, left=120, bottom=90, right=120)
        set_cell_margins(c1, top=90, left=120, bottom=90, right=120)
        set_cell_shading(c0, "F7FBFF")
        set_cell_shading(c1, "FAFAFA")
        write_cell(c0, [f"• {x}" for x in left], size=9)
        write_cell(c1, [f"• {x}" for x in right], size=9, color=GRAY)
        prevent_row_split(scope.rows[i])

    # 2. 三种范围方案
    add_heading(doc, "2. 三种范围方案：先选一个总口径")
    add_body(
        doc,
        "当前 sql/01_schema_mysql.sql 是方案 C 的完整 10 表版本。你可以选 A / B / C；选 A 或 B 后，"
        "我会删表、删字段、删索引，再给对应的最终 DDL，不会直接拿现在这份 SQL 建库。",
    )
    plan = doc.add_table(rows=4, cols=5)
    plan.alignment = WD_TABLE_ALIGNMENT.CENTER
    plan.autofit = False
    set_col_widths(plan, [Cm(2.4), Cm(1.1), Cm(6.5), Cm(4.2), Cm(2.8)])
    set_table_borders(plan, color="D9E2F3", size="4")
    plan_headers = ["方案", "表数", "包含哪些表", "适合什么情况", "我的建议"]
    for j, text in enumerate(plan_headers):
        cell = plan.cell(0, j)
        set_cell_shading(cell, HEADER_FILL)
        set_cell_margins(cell, top=90, left=90, bottom=90, right=90)
        write_cell(cell, text, size=9, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF), align=WD_ALIGN_PARAGRAPH.CENTER)
    plan_rows = [
        ("A. 最小闭环", "5", ["companies、users、", "jobs、resumes、applications"], "先跑通投递 + SQL 硬筛，不做 AI", "想最快上线选这个"),
        ("B. 推荐 V1", "7", ["A +", "application_status_logs", "+ ai_screening_results"], "要 AI 评分 + 状态时间线", "推荐：第一阶段就选 B"),
        ("C. 完整版", "10", ["B +", "skills + job_skills", "+ resume_skills"], "确定要做结构化技能匹配", "技能匹配明确再做"),
    ]
    for i, row_data in enumerate(plan_rows, start=1):
        for j, text in enumerate(row_data):
            cell = plan.cell(i, j)
            set_cell_margins(cell, top=90, left=90, bottom=90, right=90)
            if i % 2 == 0:
                set_cell_shading(cell, ALT_FILL)
            bold = (j == 0)
            color = NAVY if j == 0 else None
            align = WD_ALIGN_PARAGRAPH.CENTER if j == 1 else WD_ALIGN_PARAGRAPH.LEFT
            write_cell(cell, text, size=8.8, bold=bold, color=color, align=align)
        prevent_row_split(plan.rows[i])
    add_caption(doc, "表 1：三种范围方案。当前 SQL 对应方案 C；推荐先做方案 B。")

    add_body(
        doc,
        "方案 A 还需要同时删掉 applications 里的 AI 字段和 ai_* 状态，否则表虽然少了，字段还是残留；"
        "方案 B 保留完整 AI 链路；方案 C 才是当前这份 10 表 SQL。",
        size=9.5,
        color=GRAY,
    )

    # 表间依赖
    add_heading(doc, "3. 表间依赖：删之前先看会不会断链", level=2)
    dep = doc.add_table(rows=1, cols=1)
    dep.alignment = WD_TABLE_ALIGNMENT.CENTER
    dep.autofit = True
    set_table_borders(dep, color="D9E2F3", size="4")
    dep_cell = dep.cell(0, 0)
    set_cell_shading(dep_cell, "F7F9FC")
    set_cell_margins(dep_cell, top=120, left=160, bottom=120, right=160)
    clear_cell(dep_cell)
    dep_lines = [
        "companies",
        "  └─ users",
        "       ├─ jobs ── job_skills ── skills",
        "       └─ resumes ── resume_skills ── skills",
        "",
        "jobs + resumes ── applications ── application_status_logs",
        "                              └─ ai_screening_results",
    ]
    for idx, line in enumerate(dep_lines):
        p = dep_cell.paragraphs[0] if idx == 0 else dep_cell.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.2
        run = p.add_run(line if line else " ")
        set_run_font(run, MONO_FONT, 8.5, False, RGBColor(0x33, 0x33, 0x33))
    add_caption(doc, "删 companies / users / jobs / resumes / applications 任意一张，主链路断裂；skills 三表是旁路。")

    # 4. 逐表清单（横向页）
    landscape = doc.add_section(WD_SECTION.NEW_PAGE)
    landscape.orientation = WD_ORIENT.LANDSCAPE
    landscape.page_width = Cm(29.7)
    landscape.page_height = Cm(21)
    landscape.top_margin = Cm(1.5)
    landscape.bottom_margin = Cm(1.5)
    landscape.left_margin = Cm(1.5)
    landscape.right_margin = Cm(1.5)

    add_heading(doc, "4. 十张表：第一阶段分别会有什么内容")
    add_body(
        doc,
        "先看“建议”列：P0 必留，删了核心闭环不能跑；P1 建议保留，可后置但会失去关键体验；"
        "P2 可后置，V1 可以不做。最后一列留给你勾选“保留 / 删减 / 后置”。",
        size=9.5,
    )

    # 图例
    legend = doc.add_table(rows=1, cols=3)
    legend.alignment = WD_TABLE_ALIGNMENT.CENTER
    legend.autofit = False
    set_col_widths(legend, [Cm(8.5), Cm(8.5), Cm(8.5)])
    set_table_borders(legend, color="FFFFFF", size="0")
    legend_data = [
        ("P0 必留", "核心闭环，删了不能跑", "FCE4D6"),
        ("P1 建议保留", "可后置，但会失去关键体验", "FFF2CC"),
        ("P2 可后置", "结构化增强，V1 可删", "E2EFDA"),
    ]
    for j, (title, desc, fill) in enumerate(legend_data):
        cell = legend.cell(0, j)
        set_cell_shading(cell, fill)
        set_cell_margins(cell, top=70, left=100, bottom=70, right=100)
        write_cell(cell, [title, desc], size=8.5, bold=False, color=NAVY)
        # 第一行加粗
        cell.paragraphs[0].runs[0].bold = True

    doc.add_paragraph().paragraph_format.space_after = Pt(2)

    table = doc.add_table(rows=1, cols=7)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    widths = [Cm(0.9), Cm(3.8), Cm(4.0), Cm(8.2), Cm(5.8), Cm(1.8), Cm(2.2)]
    set_col_widths(table, widths)
    set_table_borders(table, color="D9E2F3", size="4")

    headers = ["#", "表名", "第一阶段作用", "第一阶段会存的内容", "关键字段", "建议", "你的决定"]
    for j, text in enumerate(headers):
        cell = table.cell(0, j)
        set_cell_shading(cell, HEADER_FILL)
        set_cell_margins(cell, top=60, left=65, bottom=60, right=65)
        write_cell(cell, text, size=8.2, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF), align=WD_ALIGN_PARAGRAPH.CENTER)
    set_repeat_table_header(table.rows[0])
    prevent_row_split(table.rows[0])

    rows = [
        (
            "1", "companies\n企业",
            "企业主体与 B 端租户根；企业注册、认证、启停。",
            "企业全称、简称、统一社会信用代码、行业、企业规模、总部城市、Logo、企业简介、认证状态、启停状态。",
            "id、name、short_name、unified_social_credit_code、city_code/name、verification_status、status",
            "P0\n必留",
        ),
        (
            "2", "users\n账号",
            "统一登录账号，区分求职者 / HR / 管理员。",
            "角色、所属企业、姓名、手机号、邮箱、密码哈希、账号状态、最近登录、隐私政策同意时间与版本。",
            "id、role、company_id、name、phone、email、password_hash、status、privacy_consent_at/version",
            "P0\n必留",
        ),
        (
            "3", "jobs\n职位",
            "HR 发布职位，承载 SQL 硬筛条件。",
            "企业 / 负责 HR、职位名称、部门、工作城市、工作模式、薪资上下限、最低学历、最低经验月数、招聘人数、JD 职责、要求原文、职位状态、发布 / 过期时间。",
            "id、company_id、hr_user_id、title、city_code、work_mode、salary_min/max、min_education_level、min_experience_months、status",
            "P0\n必留",
        ),
        (
            "4", "resumes\n简历",
            "求职者简历，SQL 硬筛与 AI 精筛的主要输入。",
            "姓名与联系方式、当前 / 期望城市、是否接受异地、最高学历、学校 / 专业 / 毕业年份、累计工作月数、当前公司 / 职位、期望职位 / 薪资、工作经历原文、自我评价、附件地址、可见性。",
            "id、user_id、current/expected_city_code、highest_education_level、work_months、work_experience、visibility",
            "P0\n必留",
        ),
        (
            "5", "skills\n技能字典",
            "标准化技能字典，避免 Go / Golang / go语言 这类脏标签。",
            "技能展示名、技能分类、别名 JSON 数组、启停状态。",
            "id、name、category、aliases、status",
            "P2\n可后置",
        ),
        (
            "6", "job_skills\n职位技能",
            "职位要求的技能，供 AI Prompt 与 HR 筛选器使用。",
            "职位、技能、must / plus 标记、AI 评分权重。",
            "job_id、skill_id、requirement、weight",
            "P2\n可后置",
        ),
        (
            "7", "resume_skills\n简历技能",
            "简历具备的技能，用于结构化匹配。",
            "简历、技能、熟练度、使用年限、来源（自填 / AI 抽取 / HR 确认）。",
            "resume_id、skill_id、proficiency、years、source",
            "P2\n可后置",
        ),
        (
            "8", "applications\n投递",
            "投递主表 + 状态机，是 BOSS 端漏斗的核心。",
            "职位 / 简历 / 求职者、当前状态、拒绝阶段 / 原因 / 备注、来源、投递 / 初筛 / AI 时间、AI 尝试次数。",
            "id、job_id、resume_id、seeker_user_id、status、reject_stage/reason、applied_at、ai_attempts",
            "P0\n必留",
        ),
        (
            "9", "application_status_logs\n状态流水",
            "状态变更审计 + C 端投递时间线。",
            "投递、变更前状态、变更后状态、操作者类型 / ID、变更原因、时间。",
            "application_id、from_status、to_status、operator_type、operator_id、reason、created_at",
            "P1\n建议保留",
        ),
        (
            "10", "ai_screening_results\nAI 结果",
            "AI 评分、证据、成本与可解释性。",
            "投递归属、模型 / Prompt 版本 / 输入哈希、总分 / 维度分、推荐等级、匹配与缺失技能 JSON、亮点 / 风险 JSON、总结、原始响应、Token / 成本 / 延迟、成功 / 失败。",
            "application_id、model、prompt_version、overall_score、recommendation、matched_skills、summary、status",
            "P1\n建议保留",
        ),
    ]

    for i, (num, name, purpose, content, fields, advice) in enumerate(rows, start=1):
        row = table.add_row()
        prevent_row_split(row)
        fill = ALT_FILL if i % 2 == 0 else "FFFFFF"
        for j in range(7):
            set_cell_shading(row.cells[j], fill)
            set_cell_margins(row.cells[j], top=58, left=65, bottom=58, right=65)
        write_cell(row.cells[0], num, size=8.2, bold=True, color=NAVY, align=WD_ALIGN_PARAGRAPH.CENTER)
        name_lines = name.split("\n")
        name_size = 7.7 if len(name_lines[0]) > 18 else 8.2
        write_cell(row.cells[1], [name_lines[0], name_lines[1]], size=name_size, bold=False, color=NAVY)
        row.cells[1].paragraphs[0].runs[0].bold = True
        row.cells[1].paragraphs[1].runs[0].font.size = Pt(7.2)
        row.cells[1].paragraphs[1].runs[0].font.color.rgb = GRAY
        write_cell(row.cells[2], purpose, size=7.9)
        write_cell(row.cells[3], content, size=7.9)
        write_cell(row.cells[4], fields, size=7.5, color=RGBColor(0x33, 0x33, 0x33))
        write_cell(row.cells[5], advice, size=8.0, bold=True, color=NAVY, align=WD_ALIGN_PARAGRAPH.CENTER)
        write_cell(
            row.cells[6],
            ["□ 保留", "□ 删减", "□ 后置"],
            size=8.0,
            color=GRAY,
            align=WD_ALIGN_PARAGRAPH.CENTER,
        )

    add_caption(doc, "表 2：十张候选表逐表清单。P0 五张是核心闭环；P1 两张决定体验；P2 三张是技能结构化增强。")

    # 5. 删减影响速查（回到纵向）
    portrait = doc.add_section(WD_SECTION.NEW_PAGE)
    portrait.orientation = WD_ORIENT.PORTRAIT
    portrait.page_width = Cm(21)
    portrait.page_height = Cm(29.7)
    portrait.top_margin = Cm(1.8)
    portrait.bottom_margin = Cm(1.8)
    portrait.left_margin = Cm(2.0)
    portrait.right_margin = Cm(2.0)

    add_heading(doc, "5. 删减影响速查")
    add_body(
        doc,
        "如果你在犹豫“这个能不能删”，先看这张表。核心原则："
        "少一张核心表不是少一个功能，而是整条投递/筛选链路断掉；旁路表才可以后置。",
    )

    impact = doc.add_table(rows=1, cols=4)
    impact.alignment = WD_TABLE_ALIGNMENT.CENTER
    impact.autofit = False
    set_col_widths(impact, [Cm(4.2), Cm(2.8), Cm(5.5), Cm(4.5)])
    set_table_borders(impact, color="D9E2F3", size="4")
    impact_headers = ["删减对象", "还能跑通吗", "会失去什么", "建议"]
    for j, text in enumerate(impact_headers):
        cell = impact.cell(0, j)
        set_cell_shading(cell, HEADER_FILL)
        set_cell_margins(cell, top=90, left=100, bottom=90, right=100)
        write_cell(cell, text, size=9, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF), align=WD_ALIGN_PARAGRAPH.CENTER)
    set_repeat_table_header(impact.rows[0])

    impact_rows = [
        ("companies / users / jobs / resumes / applications", "不能", "核心闭环断裂：没有企业、职位、简历或投递，漏斗跑不起来。", "不要删"),
        ("application_status_logs", "能", "没有历史时间线和审计；C 端只能看当前状态。", "可后置，但建议保留"),
        ("ai_screening_results", "能（如果 V1 不做 AI）", "没有评分、证据、Token / 成本记录；applications 的 AI 字段也要同步删。", "V1 不做 AI 才删"),
        ("skills + job_skills + resume_skills", "能", "没有结构化技能筛选；AI 仍可读 JD / 简历原文。", "推荐 V1 后置"),
        ("jobs / resumes 的 FULLTEXT 索引", "能", "只能按结构化条件筛选，不能搜 JD / 经历关键词。", "可后置，不影响硬筛"),
        ("企业 Logo / 简介 / 信用代码", "能", "企业展示和认证能力变弱。", "可后置"),
        ("职位部门 / 招聘人数 / 过期时间", "能", "职位管理粒度变粗。", "可后置"),
        ("简历附件 / 自我评价 / 期望薪资", "能", "AI 输入和候选人体验下降。", "按需保留"),
    ]
    for i, row_data in enumerate(impact_rows, start=1):
        row = impact.add_row()
        prevent_row_split(row)
        for j, text in enumerate(row_data):
            cell = row.cells[j]
            set_cell_margins(cell, top=80, left=100, bottom=80, right=100)
            if i % 2 == 0:
                set_cell_shading(cell, ALT_FILL)
            color = None
            bold = False
            if j == 3:
                color = NAVY
                bold = True
            write_cell(cell, text, size=8.8, bold=bold, color=color, align=WD_ALIGN_PARAGRAPH.CENTER if j == 1 else WD_ALIGN_PARAGRAPH.LEFT)
    add_caption(doc, "表 3：删减影响速查。核心表不要动；旁路表按第一阶段目标决定。")

    # 6. 推荐
    add_heading(doc, "6. 我的推荐：先做方案 B，7 张表")
    add_body(doc, "理由很直接：")
    add_bullet(doc, "SQL 硬筛只需要 companies、users、jobs、resumes、applications 这 5 张表。")
    add_bullet(doc, "application_status_logs 让 BOSS 端有审计、C 端有投递时间线，删了体验会明显变弱。")
    add_bullet(doc, "ai_screening_results 让评分、证据、Token 成本可追溯，是 AI 产品的差异点。")
    add_bullet(doc, "技能三张表是结构化增强，不是 V1 必需；AI 读 JD 和简历原文就能做第一版匹配。")
    add_bullet(doc, "等“技能筛选”被验证为高频需求，再加回三张表，不会推翻主模型。")

    add_body(
        doc,
        "如果完全不做 AI，选 A（同时删掉 applications 的 AI 字段）；确定要做技能筛选，选 C；否则 B 最稳。",
        size=9.5,
        color=GRAY,
    )

    # 7. 请你确认
    add_heading(doc, "7. 请你确认")
    add_body(doc, "你只需要在下面勾选或直接回我一句话；我按你的选择改 SQL，不会先建库。")

    confirm = doc.add_table(rows=6, cols=2)
    confirm.alignment = WD_TABLE_ALIGNMENT.CENTER
    confirm.autofit = False
    set_col_widths(confirm, [Cm(5.0), Cm(12.0)])
    set_table_borders(confirm, color="D9E2F3", size="4")
    confirm_rows = [
        ("第一阶段方案", "□ A 最小 5 表　　□ B 推荐 7 表　　□ C 完整 10 表"),
        ("需要删减 / 后置的表", "________________________________________________"),
        ("需要删减 / 后置的字段", "________________________________________________"),
        ("FULLTEXT 索引", "□ 保留　　□ 后置"),
        ("其他要求", "________________________________________________"),
        ("评审人 / 日期", "____________________　　____年__月__日"),
    ]
    for i, (key, value) in enumerate(confirm_rows):
        c0, c1 = confirm.rows[i].cells
        set_cell_margins(c0, top=90, left=110, bottom=90, right=100)
        set_cell_margins(c1, top=90, left=110, bottom=90, right=100)
        set_cell_shading(c0, "EAF2FB")
        write_cell(c0, key, size=9, bold=True, color=NAVY)
        write_cell(c1, value, size=9, color=GRAY)
        prevent_row_split(confirm.rows[i])

    add_heading(doc, "8. 确认后我会做什么", level=2)
    add_bullet(doc, "按你选的方案删表、删字段、删索引，更新 sql/01_schema_mysql.sql。")
    add_bullet(doc, "同步更新数据库设计说明，保证文档和 SQL 一致。")
    add_bullet(doc, "只做只读环境检查（版本、连接、已有库），再执行建表。")
    add_bullet(doc, "建表后检查 10 / 7 / 5 张表、外键、B+ 树索引和 FULLTEXT 是否生效。")
    add_bullet(doc, "数据库确认之前，不接 AI、不写后端业务代码。")

    p = doc.add_paragraph()
    style_paragraph(p, space_before=10, space_after=0, line_spacing=1.3, align=WD_ALIGN_PARAGRAPH.CENTER)
    r = p.add_run("— 先定范围，再动数据库 —")
    set_run_font(r, BODY_FONT, 9, False, GRAY)

    # 让 Word 打开时刷新页码字段
    settings = doc.settings.element
    update_fields = OxmlElement("w:updateFields")
    update_fields.set(qn("w:val"), "true")
    settings.append(update_fields)

    return doc


if __name__ == "__main__":
    document = build_document()
    output = "docs/BOSS端数据库第一阶段范围评审.docx"
    document.save(output)
    print(output)
