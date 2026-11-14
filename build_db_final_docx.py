# -*- coding: utf-8 -*-
"""生成 BOSS 端数据库第一阶段最终方案 Word 文档（5 表简单版）。"""

from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

from build_db_review_docx import (
    ALT_FILL,
    BODY_FONT,
    CALLOUT_BLUE,
    CALLOUT_BLUE_BORDER,
    CALLOUT_YELLOW,
    CALLOUT_YELLOW_BORDER,
    GRAY,
    HEADER_FILL,
    NAVY,
    add_body,
    add_bullet,
    add_callout,
    add_caption,
    add_heading,
    add_page_field,
    prevent_row_split,
    set_cell_margins,
    set_cell_shading,
    set_col_widths,
    set_repeat_table_header,
    set_run_font,
    set_table_borders,
    style_paragraph,
    write_cell,
)


def build_final_header_footer(section):
    header = section.header
    header.is_linked_to_previous = False
    hp = header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hp.paragraph_format.space_after = Pt(0)
    hr = hp.add_run("简历筛选平台 · BOSS 端数据库第一阶段最终方案")
    set_run_font(hr, BODY_FONT, 8, False, GRAY)

    footer = section.footer
    footer.is_linked_to_previous = False
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fp.paragraph_format.space_before = Pt(0)
    fp.paragraph_format.space_after = Pt(0)
    r1 = fp.add_run("最终方案 · 第 ")
    set_run_font(r1, BODY_FONT, 8, False, GRAY)
    add_page_field(fp, "PAGE")
    r2 = fp.add_run(" 页 / 共 ")
    set_run_font(r2, BODY_FONT, 8, False, GRAY)
    add_page_field(fp, "NUMPAGES")
    r3 = fp.add_run(" 页")
    set_run_font(r3, BODY_FONT, 8, False, GRAY)


def add_simple_table(doc, rows, widths, font_size=8.8, header_fill=HEADER_FILL, cell_padding=75):
    table = doc.add_table(rows=1, cols=len(widths))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_col_widths(table, widths)
    set_table_borders(table, color="D9E2F3", size="4")
    headers = rows[0]
    for j, text in enumerate(headers):
        cell = table.cell(0, j)
        set_cell_shading(cell, header_fill)
        set_cell_margins(cell, top=cell_padding, left=90, bottom=cell_padding, right=90)
        write_cell(
            cell,
            text,
            size=font_size,
            bold=True,
            color=RGBColor(0xFF, 0xFF, 0xFF),
            align=WD_ALIGN_PARAGRAPH.CENTER,
        )
    set_repeat_table_header(table.rows[0])
    prevent_row_split(table.rows[0])
    for i, row_data in enumerate(rows[1:], start=1):
        row = table.add_row()
        prevent_row_split(row)
        for j, value in enumerate(row_data):
            cell = row.cells[j]
            set_cell_margins(cell, top=cell_padding, left=90, bottom=cell_padding, right=90)
            if i % 2 == 0:
                set_cell_shading(cell, ALT_FILL)
            write_cell(cell, value, size=font_size)
    return table


def build_document():
    doc = Document()
    doc.core_properties.title = "BOSS 端数据库第一阶段最终方案"
    doc.core_properties.subject = "简历筛选平台 MySQL 第一阶段 5 表简单版"
    doc.core_properties.author = "AI 产品经理 / 全栈架构师"
    doc.core_properties.comments = "已按用户删减决定收敛为 5 张表，AI 与技能表后置。"

    normal = doc.styles["Normal"]
    normal.font.name = BODY_FONT
    normal.font.size = Pt(10.5)
    normal.element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:eastAsia"), BODY_FONT)
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
    build_final_header_footer(section)

    # 标题
    p = doc.add_paragraph()
    style_paragraph(p, space_before=4, space_after=2, line_spacing=1.1)
    r = p.add_run("BOSS 端数据库 · 第一阶段最终方案")
    set_run_font(r, BODY_FONT, 22, True, NAVY)

    p = doc.add_paragraph()
    style_paragraph(p, space_before=0, space_after=10, line_spacing=1.2)
    r = p.add_run("5 张核心表 / MySQL 8.0 / 简单平台版")
    set_run_font(r, BODY_FONT, 11, False, GRAY)

    # 文档信息
    info = doc.add_table(rows=5, cols=2)
    info.alignment = WD_TABLE_ALIGNMENT.CENTER
    info.autofit = False
    set_col_widths(info, [Cm(4.0), Cm(13.0)])
    set_table_borders(info, color="D9E2F3", size="4")
    info_data = [
        ("文档版本", "v1.0 最终方案"),
        ("数据库", "resume_screening（MySQL 8.0）"),
        ("第一阶段范围", "5 张表：companies、users、jobs、resumes、applications"),
        ("后置范围", "skills、job_skills、resume_skills、application_status_logs、ai_screening_results"),
        ("当前状态", "已按你的删减决定收敛；待改 SQL 后建库"),
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
        "第一阶段就做 5 张表",
        "企业、账号、职位、简历、投递。先把“发职位 → 投简历 → SQL 硬筛 → HR 处理”跑通；"
        "AI 评分、技能标签、状态流水全部后置，不拖慢第一版上线。",
        CALLOUT_BLUE,
        CALLOUT_BLUE_BORDER,
    )
    doc.add_paragraph().paragraph_format.space_after = Pt(1)
    add_callout(
        doc,
        "你保留的关键字段，我也留下了",
        "jobs.city_code/name（城市硬筛）、jobs.description/requirements（JD 展示与以后 AI 输入）、"
        "resumes.expected_city_code/name（和职位城市比较）、resumes.work_experience（以后 AI 输入）。"
        "这些字段先允许为空，不用可以空着，删了以后要补表补字段。",
        CALLOUT_YELLOW,
        CALLOUT_YELLOW_BORDER,
    )

    # 1. 最终范围
    add_heading(doc, "1. 最终范围：5 张表 + 5 张后置表")
    add_body(
        doc,
        "这一版不再追求“完整”，只追求“能跑通”。下面是最终保留的 5 张表，以及明确后置的 5 张表。",
    )
    scope = doc.add_table(rows=6, cols=2)
    scope.alignment = WD_TABLE_ALIGNMENT.CENTER
    scope.autofit = False
    set_col_widths(scope, [Cm(8.5), Cm(8.5)])
    set_table_borders(scope, color="D9E2F3", size="4")
    for j, text in enumerate(("保留：第一阶段就建", "后置：第一阶段不建")):
        cell = scope.cell(0, j)
        set_cell_shading(cell, HEADER_FILL)
        set_cell_margins(cell, top=90, left=120, bottom=90, right=120)
        write_cell(cell, text, size=9.5, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
    keep_items = ["companies 企业", "users 账号", "jobs 职位", "resumes 简历", "applications 投递"]
    defer_items = ["skills 技能字典", "job_skills 职位技能", "resume_skills 简历技能", "application_status_logs 状态流水", "ai_screening_results AI 结果"]
    for i in range(5):
        c0, c1 = scope.rows[i + 1].cells
        set_cell_margins(c0, top=75, left=120, bottom=75, right=120)
        set_cell_margins(c1, top=75, left=120, bottom=75, right=120)
        set_cell_shading(c0, "F7FBFF")
        set_cell_shading(c1, "FAFAFA")
        write_cell(c0, f"• {keep_items[i]}", size=9)
        write_cell(c1, f"• {defer_items[i]}", size=9, color=GRAY)
        prevent_row_split(scope.rows[i + 1])
    add_caption(doc, "表 1：第一阶段只建左边 5 张表；右边 5 张等以后需要时再加。")

    # 2. 5 张表字段
    add_heading(doc, "2. 五张表分别存什么")
    add_body(
        doc,
        "字段已经按你的精简版收敛；最后一列是必须保留的约束/索引。字段名可以直接对应后面的 MySQL 建表 SQL。",
    )
    field_table = doc.add_table(rows=1, cols=3)
    field_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    field_table.autofit = False
    set_col_widths(field_table, [Cm(2.8), Cm(10.0), Cm(4.2)])
    set_table_borders(field_table, color="D9E2F3", size="4")
    for j, text in enumerate(("表名 / 用途", "第一阶段字段", "关键约束 / 索引")):
        cell = field_table.cell(0, j)
        set_cell_shading(cell, HEADER_FILL)
        set_cell_margins(cell, top=80, left=90, bottom=80, right=90)
        write_cell(cell, text, size=8.8, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF), align=WD_ALIGN_PARAGRAPH.CENTER)
    set_repeat_table_header(field_table.rows[0])
    prevent_row_split(field_table.rows[0])

    rows = [
        (
            "companies\n企业",
            "id、name（企业全称）、description（企业简介）、industry（行业）、created_at、updated_at",
            "主键 id；name 普通索引；企业不做物理删除",
        ),
        (
            "users\n账号",
            "id、role（seeker/hr）、company_id、name、phone、password_hash、created_at、updated_at",
            "phone 唯一；company_id + role 索引；HR 必须有 company_id",
        ),
        (
            "jobs\n职位",
            "id、company_id、hr_user_id、title、department、salary_min、salary_max、min_education_level、min_experience_months、city_code、city_name、description、requirements、status、created_at、updated_at",
            "company_id + status 索引；status + city + 学历 + 经验组合索引；FULLTEXT（title, description, requirements）",
        ),
        (
            "resumes\n简历",
            "id、user_id、full_name、contact_phone、contact_email、expected_city_code、expected_city_name、highest_education_level、school、graduation_year、work_months、work_experience、self_evaluation、created_at、updated_at",
            "user_id 唯一；expected_city + 学历 + 工作月数索引；FULLTEXT（work_experience, self_evaluation）",
        ),
        (
            "applications\n投递",
            "id、job_id、resume_id、seeker_user_id、status、reject_stage、reject_reason、reject_note、applied_at、screened_at、hr_viewed_at、updated_at",
            "job_id + resume_id 唯一；job_id + status + applied_at 索引；seeker_id + status + applied_at 索引；复合外键保证简历归属",
        ),
    ]
    for i, (name, fields, constraints) in enumerate(rows, start=1):
        row = field_table.add_row()
        prevent_row_split(row)
        for j in range(3):
            cell = row.cells[j]
            set_cell_margins(cell, top=75, left=90, bottom=75, right=90)
            if i % 2 == 0:
                set_cell_shading(cell, ALT_FILL)
        name_lines = name.split("\n")
        write_cell(row.cells[0], [name_lines[0], name_lines[1]], size=8.5, bold=False, color=NAVY)
        row.cells[0].paragraphs[0].runs[0].bold = True
        row.cells[0].paragraphs[1].runs[0].font.size = Pt(7.5)
        row.cells[0].paragraphs[1].runs[0].font.color.rgb = GRAY
        write_cell(row.cells[1], fields, size=8.2)
        write_cell(row.cells[2], constraints, size=7.8, color=RGBColor(0x33, 0x33, 0x33))

    add_caption(doc, "表 2：五张表的最终字段。状态字段取值见第 3 节。")

    # 3. 状态与规则
    add_heading(doc, "3. 状态与硬筛规则")
    add_body(
        doc,
        "第一阶段没有 AI，applications 只保留 6 个状态：待筛选、初筛通过、面试中、已录用、已拒绝、已撤回。",
    )
    state = add_simple_table(
        doc,
        [
            ("对象", "取值", "说明"),
            ("users.role", "seeker / hr", "求职者 / 企业 HR；第一阶段不做管理员后台"),
            ("jobs.status", "draft / published / paused / closed", "草稿 / 已发布 / 已暂停 / 已关闭"),
            ("applications.status", "pending / screened / rejected / interview / hired / withdrawn", "待筛选 / 初筛通过 / 已拒绝 / 面试中 / 已录用 / 已撤回"),
            ("applications.reject_stage", "sql / manual", "SQL 初筛拒绝 / HR 手动拒绝"),
            ("applications.reject_reason", "education / experience / city / other", "学历 / 经验 / 城市 / 其他"),
        ],
        [Cm(4.8), Cm(6.6), Cm(5.6)],
        font_size=8.4,
        cell_padding=55,
    )

    add_body(doc, "SQL 硬筛只做三件事：学历、经验、城市。", bold=True, space_after=3)
    add_bullet(doc, "学历：resumes.highest_education_level >= jobs.min_education_level")
    add_bullet(doc, "经验：resumes.work_months >= jobs.min_experience_months")
    add_bullet(doc, "城市：第一阶段不做远程职位，只按 jobs.city_code = resumes.expected_city_code 比较；城市字段可以为空，为空时不做城市过滤。")
    add_bullet(doc, "通过 → applications.status = screened；不通过 → rejected，并写 reject_stage = sql、reject_reason。")
    add_body(
        doc,
        "这版没有 AI、没有技能表、没有状态流水；HR 看到 screened 的投递后，手动改成 interview / hired / rejected。",
        size=9.5,
        color=GRAY,
    )

    # 4. 本次删减
    add_heading(doc, "4. 本次删减了什么")
    add_body(
        doc,
        "下面这些不是永远不做，而是第一阶段不做。删掉它们能让表更少、字段更少、后端更简单；以后需要时按“怎么加回来”补。",
    )
    cuts = add_simple_table(
        doc,
        [
            ("删减项", "第一阶段影响", "以后怎么加"),
            ("skills / job_skills / resume_skills", "没有结构化技能匹配；JD 和简历里的技能仍然以文本存在。", "新增三张表，挂到 jobs / resumes 上；AI 或 HR 再打标签。"),
            ("application_status_logs", "没有状态历史；C 端只能看当前状态。", "新增日志表，状态变更时追加一条。"),
            ("ai_screening_results", "没有 AI 评分、证据、Token 成本。", "新增结果表 + AI Worker；applications 补 ai_processing / ai_completed 状态。"),
            ("applications 的 AI 字段", "没有 ai_started_at / ai_completed_at / ai_attempts。", "做 AI 时再加列，不影响现有投递数据。"),
            ("企业信用代码 / 认证 / Logo / 规模", "企业注册更简单，没有认证流程。", "companies 补列；认证逻辑后置。"),
            ("用户邮箱 / 头像 / 状态 / 最近登录", "手机号 + 密码登录；没有禁用和登录审计。", "users 补列；上线运营前建议补 status。"),
            ("职位招聘人数 / 工作模式 / 发布过期时间", "职位管理更轻；只保留发布/暂停/关闭。", "jobs 补列；不影响现有硬筛。"),
            ("简历当前城市 / 异地 / 专业 / 当前公司 / 期望薪资 / 附件 / 可见性", "简历更轻；只保留姓名、联系方式、学历、学校、毕业年份、工作月数、工作经历、自我评价。", "resumes 补列；附件和人才库后置。"),
        ],
        [Cm(5.2), Cm(6.0), Cm(5.8)],
        font_size=8.3,
    )
    add_caption(doc, "表 4：本次删减项。删掉的是“第一阶段不做”，不是“永远不做”。")

    # 5. 流程
    doc.add_page_break()
    flow_heading = add_heading(doc, "5. 第一阶段能跑通的流程")
    flow_heading.paragraph_format.keep_with_next = True
    flow = doc.add_table(rows=1, cols=1)
    flow.alignment = WD_TABLE_ALIGNMENT.CENTER
    flow.autofit = True
    set_table_borders(flow, color="D9E2F3", size="4")
    prevent_row_split(flow.rows[0])
    cell = flow.cell(0, 0)
    set_cell_shading(cell, "F7F9FC")
    set_cell_margins(cell, top=120, left=160, bottom=120, right=160)
    cell.text = ""
    flow_lines = [
        "企业注册 / HR 登录",
        "  → 发布职位（硬条件 + JD）",
        "    → 求职者注册 / 填简历",
        "      → 投递（applications.pending）",
        "        → SQL 硬筛：学历 / 经验 / 城市",
        "          → screened 或 rejected",
        "            → HR 查看 screened",
        "              → interview / hired / rejected",
    ]
    for idx, line in enumerate(flow_lines):
        p = cell.paragraphs[0] if idx == 0 else cell.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.25
        run = p.add_run(line)
        set_run_font(run, BODY_FONT, 9, False, RGBColor(0x33, 0x33, 0x33))

    add_body(
        doc,
        "这条链路不需要 AI，也不需要技能表。第一版先把投递和硬筛跑通，HR 的人工判断就是“精筛”。",
        size=9.5,
        color=GRAY,
    )

    # 6. 上线前补
    add_heading(doc, "6. 正式上线前建议补的 3 件事")
    add_body(
        doc,
        "如果只是本地开发/内测，下面三件可以先不做；但只要开始收集真实简历，就建议补上。",
    )
    add_bullet(doc, "隐私同意：users 补 privacy_consent_at / privacy_consent_version，收集简历前必须让用户同意隐私政策。")
    add_bullet(doc, "账号/企业停用：users.status、companies.status，避免违规账号无法下线。")
    add_bullet(doc, "状态流水：application_status_logs，方便 C 端看时间线、BOSS 端做审计。")

    # 7. 下一步
    add_heading(doc, "7. 下一步")
    add_body(doc, "这版 Word 你确认后，我按它改 SQL，不再保留 10 表版本。", bold=True)
    add_bullet(doc, "把 sql/01_schema_mysql.sql 收敛为 5 张表。")
    add_bullet(doc, "删掉 skills / job_skills / resume_skills / application_status_logs / ai_screening_results。")
    add_bullet(doc, "删掉 applications 的 AI 字段和 ai_processing / ai_completed 状态。")
    add_bullet(doc, "保留 FULLTEXT 索引（jobs、resumes），但只做关键词搜索，不参与硬筛。")
    add_bullet(doc, "然后做只读环境检查，确认 MySQL 版本/连接/已有库，再执行建表。")

    confirm = doc.add_table(rows=3, cols=2)
    confirm.alignment = WD_TABLE_ALIGNMENT.CENTER
    confirm.autofit = False
    set_col_widths(confirm, [Cm(5.0), Cm(12.0)])
    set_table_borders(confirm, color="D9E2F3", size="4")
    confirm_rows = [
        ("确认结论", "□ 同意按 5 张表进入 SQL 修改"),
        ("评审人 / 日期", "____________________　　____年__月__日"),
        ("备注", "________________________________________________"),
    ]
    for i, (key, value) in enumerate(confirm_rows):
        c0, c1 = confirm.rows[i].cells
        set_cell_margins(c0, top=90, left=110, bottom=90, right=100)
        set_cell_margins(c1, top=90, left=110, bottom=90, right=100)
        set_cell_shading(c0, "EAF2FB")
        write_cell(c0, key, size=9, bold=True, color=NAVY)
        write_cell(c1, value, size=9, color=GRAY)
        prevent_row_split(confirm.rows[i])

    p = doc.add_paragraph()
    style_paragraph(p, space_before=10, space_after=0, line_spacing=1.3, align=WD_ALIGN_PARAGRAPH.CENTER)
    r = p.add_run("— 先做小闭环，再谈 AI —")
    set_run_font(r, BODY_FONT, 9, False, GRAY)

    settings = doc.settings.element
    update_fields = OxmlElement("w:updateFields")
    update_fields.set(qn("w:val"), "true")
    settings.append(update_fields)

    return doc


if __name__ == "__main__":
    document = build_document()
    output = "docs/BOSS端数据库第一阶段最终方案.docx"
    document.save(output)
    print(output)
