-- ============================================================
-- 简历筛选平台 · BOSS 端 MySQL 8.0 建表脚本（第一阶段 5 表版）
-- ------------------------------------------------------------
-- 依据 ：docs/BOSS端数据库第一阶段最终方案.docx
-- 版本 ：v1.1（简单平台版）
-- 目标 ：MySQL 8.0.16+（推荐 8.0.36+ / 8.4 LTS）
-- 字符集：utf8mb4 / utf8mb4_0900_ai_ci
-- 引擎 ：InnoDB
-- 范围 ：companies、users、jobs、resumes、applications
-- 后置 ：skills、job_skills、resume_skills、application_status_logs、
--        ai_screening_results
-- 说明 ：
--   1. 关系筛选用 InnoDB 普通 B+ 树索引；
--   2. JD / 简历长文本保留 FULLTEXT + ngram，只做关键词搜索；
--   3. 第一阶段没有 AI，因此 applications 不含任何 AI 字段/状态；
--   4. 时间统一使用 DATETIME，建议 MySQL 服务端 time_zone = '+08:00'；
--   5. CHECK 约束在 MySQL 8.0.16+ 才会真正生效。
-- ============================================================
-- 【执行前必读】
-- 1. 本脚本按“全新数据库”编写，不是幂等脚本。
-- 2. 首次建库：保持下面的 DROP DATABASE 注释，直接执行。
-- 3. 重建：取消 DROP DATABASE 注释（会删除整个库及数据），再执行。
-- 4. 只写 CREATE DATABASE IF NOT EXISTS 不会重建表；重复执行本脚本
--    会在建表语句处报 “table already exists”。
-- 5. 如果只想保留数据，不要重复执行本脚本；请改用迁移工具。
-- ============================================================
-- 【常见报错】ERROR 1050 Table 'companies' already exists
-- 含义：这张表已经建过，不是脚本写错，而是重复执行了建表脚本。
-- 处理：不要重复执行；需要重建时，打开下面的 DROP DATABASE 开关。
-- ============================================================

-- ============================================================
-- 重建开关（默认关闭）
-- 取消下一行注释会删除整个 resume_screening 库及所有数据！
-- 仅本地开发、确认不需要保留数据时使用。
-- ============================================================
-- DROP DATABASE IF EXISTS resume_screening;

CREATE DATABASE IF NOT EXISTS resume_screening
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE resume_screening;

SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- 1. companies：企业
-- ------------------------------------------------------------
CREATE TABLE companies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '企业ID',
  name VARCHAR(200) NOT NULL COMMENT '企业全称',
  description TEXT NULL COMMENT '企业简介',
  industry VARCHAR(64) NULL COMMENT '所属行业',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_companies_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='企业信息表';

-- ------------------------------------------------------------
-- 2. users：统一账号（求职者 / HR）
-- ------------------------------------------------------------
CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  role VARCHAR(16) NOT NULL COMMENT 'seeker求职者 hr企业HR',
  company_id BIGINT UNSIGNED NULL COMMENT 'HR所属企业ID；求职者为NULL',
  name VARCHAR(64) NOT NULL COMMENT '姓名/昵称',
  phone VARCHAR(20) NOT NULL COMMENT '手机号',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希，禁止明文',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_phone (phone),
  UNIQUE KEY uk_users_id_company (id, company_id),
  KEY idx_users_company_role (company_id, role),
  CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_users_role CHECK (role IN ('seeker', 'hr')),
  CONSTRAINT chk_users_hr_company CHECK (role <> 'hr' OR company_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='统一用户账号表';

-- ------------------------------------------------------------
-- 3. jobs：职位
-- ------------------------------------------------------------
CREATE TABLE jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '职位ID',
  company_id BIGINT UNSIGNED NOT NULL COMMENT '企业ID',
  hr_user_id BIGINT UNSIGNED NOT NULL COMMENT '负责HR的用户ID',
  title VARCHAR(128) NOT NULL COMMENT '职位名称',
  department VARCHAR(64) NULL COMMENT '部门',
  salary_min INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '月薪下限（元），0表示面议',
  salary_max INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '月薪上限（元），0表示面议',
  min_education_level TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '最低学历：0不限 1高中及以下 2大专 3本科 4硕士 5博士',
  min_experience_months INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '最低经验月数，0不限/应届',
  city_code CHAR(6) NULL COMMENT '工作城市行政区划码，可空',
  city_name VARCHAR(64) NULL COMMENT '工作城市名称，可空',
  description MEDIUMTEXT NULL COMMENT '岗位职责/JD正文',
  requirements MEDIUMTEXT NULL COMMENT '任职要求原文',
  status VARCHAR(16) NOT NULL DEFAULT 'draft' COMMENT 'draft草稿 published已发布 paused已暂停 closed已关闭',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_jobs_company_status (company_id, status, created_at),
  KEY idx_jobs_screening (status, city_code, min_education_level, min_experience_months),
  KEY idx_jobs_hr_company (hr_user_id, company_id),
  FULLTEXT KEY ft_jobs_text (title, description, requirements) WITH PARSER ngram,
  CONSTRAINT fk_jobs_company FOREIGN KEY (company_id) REFERENCES companies (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_jobs_hr_company FOREIGN KEY (hr_user_id, company_id) REFERENCES users (id, company_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_jobs_salary CHECK (salary_max >= salary_min),
  CONSTRAINT chk_jobs_education CHECK (min_education_level BETWEEN 0 AND 5),
  CONSTRAINT chk_jobs_status CHECK (status IN ('draft', 'published', 'paused', 'closed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='职位表';

-- ------------------------------------------------------------
-- 4. resumes：简历
-- ------------------------------------------------------------
CREATE TABLE resumes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '简历ID',
  user_id BIGINT UNSIGNED NOT NULL COMMENT '求职者用户ID',
  full_name VARCHAR(64) NOT NULL COMMENT '姓名',
  contact_phone VARCHAR(20) NOT NULL COMMENT '联系方式手机号',
  contact_email VARCHAR(255) NULL COMMENT '联系方式邮箱',
  expected_city_code CHAR(6) NULL COMMENT '期望城市行政区划码，可空',
  expected_city_name VARCHAR(64) NULL COMMENT '期望城市名称，可空',
  highest_education_level TINYINT UNSIGNED NOT NULL COMMENT '最高学历：1高中及以下 2大专 3本科 4硕士 5博士',
  school VARCHAR(128) NULL COMMENT '学校',
  graduation_year SMALLINT UNSIGNED NULL COMMENT '毕业年份',
  work_months INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '累计工作月数',
  work_experience MEDIUMTEXT NULL COMMENT '工作经历原文（以后AI输入）',
  self_evaluation TEXT NULL COMMENT '自我评价',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_resumes_user (user_id),
  UNIQUE KEY uk_resumes_id_user (id, user_id),
  KEY idx_resumes_screening (expected_city_code, highest_education_level, work_months),
  FULLTEXT KEY ft_resumes_text (work_experience, self_evaluation) WITH PARSER ngram,
  CONSTRAINT fk_resumes_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_resumes_education CHECK (highest_education_level BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='简历表';

-- ------------------------------------------------------------
-- 5. applications：投递
-- ------------------------------------------------------------
CREATE TABLE applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '投递ID',
  job_id BIGINT UNSIGNED NOT NULL COMMENT '职位ID',
  resume_id BIGINT UNSIGNED NOT NULL COMMENT '简历ID',
  seeker_user_id BIGINT UNSIGNED NOT NULL COMMENT '求职者用户ID（冗余，便于C端查询）',
  status VARCHAR(24) NOT NULL DEFAULT 'pending' COMMENT 'pending待筛选 screened初筛通过 rejected已拒绝 interview面试中 hired已录用 withdrawn已撤回',
  reject_stage VARCHAR(16) NULL COMMENT '拒绝阶段：sql/manual',
  reject_reason VARCHAR(64) NULL COMMENT '拒绝原因：education/experience/city/other',
  reject_note VARCHAR(255) NULL COMMENT '拒绝补充说明，C端展示需脱敏',
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '投递时间',
  screened_at DATETIME NULL COMMENT 'SQL初筛时间',
  hr_viewed_at DATETIME NULL COMMENT 'HR最近查看时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_applications_job_resume (job_id, resume_id),
  KEY idx_applications_job_status (job_id, status, applied_at),
  KEY idx_applications_seeker (seeker_user_id, status, applied_at),
  KEY idx_applications_resume_seeker (resume_id, seeker_user_id),
  CONSTRAINT fk_applications_job FOREIGN KEY (job_id) REFERENCES jobs (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_applications_resume_owner FOREIGN KEY (resume_id, seeker_user_id)
    REFERENCES resumes (id, user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_applications_status CHECK (
    status IN ('pending', 'screened', 'rejected', 'interview', 'hired', 'withdrawn')
  ),
  CONSTRAINT chk_applications_reject_stage CHECK (
    reject_stage IS NULL OR reject_stage IN ('sql', 'manual')
  ),
  CONSTRAINT chk_applications_reject_reason CHECK (
    reject_reason IS NULL OR reject_reason IN ('education', 'experience', 'city', 'other')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='投递表';

-- ============================================================
-- 建表完成后的快速自检
-- ============================================================
-- SHOW TABLES;
-- 应为 5 张：companies、users、jobs、resumes、applications
--
-- SELECT table_name, table_comment
-- FROM information_schema.tables
-- WHERE table_schema = 'resume_screening'
-- ORDER BY table_name;
--
-- 检查全文索引
-- SHOW INDEX FROM jobs WHERE Index_type = 'FULLTEXT';
-- SHOW INDEX FROM resumes WHERE Index_type = 'FULLTEXT';
