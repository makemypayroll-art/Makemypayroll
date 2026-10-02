-- =============================================================
-- NovaPulse / MakeMyPayroll — Production Task Management & Workflow Schema
-- Migration: 20261002_task_management_schema.sql
-- =============================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------
-- 1. TASKS TABLE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_code VARCHAR(32) NOT NULL,
    organization_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_by_id VARCHAR(64) NOT NULL,
    assigned_by_name VARCHAR(128) NOT NULL,
    assigned_to_id VARCHAR(64) NOT NULL,
    assigned_to_name VARCHAR(128) NOT NULL,
    assigned_to_avatar TEXT,
    department_id VARCHAR(64),
    department_name VARCHAR(128),
    designation_id VARCHAR(64),
    designation_title VARCHAR(128),
    priority VARCHAR(32) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    category VARCHAR(64) NOT NULL DEFAULT 'General',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'Pending', 'In Progress', 'On Hold', 'Completed', 'Cancelled', 'Overdue')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    additional_instructions TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & multi-tenant isolation
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_id ON tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by_id ON tasks(assigned_by_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_department_id ON tasks(department_id);

-- -------------------------------------------------------------
-- 2. TASK SUBTASKS / CHECKLIST TABLE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    completed_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_id ON task_subtasks(task_id);

-- -------------------------------------------------------------
-- 3. TASK COMMENTS TABLE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id VARCHAR(64) NOT NULL,
    author_name VARCHAR(128) NOT NULL,
    author_role VARCHAR(64) NOT NULL,
    department_name VARCHAR(128),
    content TEXT NOT NULL,
    attachments TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);

-- -------------------------------------------------------------
-- 4. TASK ATTACHMENTS TABLE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    size VARCHAR(32),
    upload_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);

-- -------------------------------------------------------------
-- 5. TASK ACTIVITIES / AUDIT LOG TABLE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL,
    user_name VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    details TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_activities_task_id ON task_activities(task_id);

-- -------------------------------------------------------------
-- 6. TEAM PROJECTS TABLE (SEQUENTIAL WORKFLOWS)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_code VARCHAR(32) NOT NULL,
    organization_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    client VARCHAR(255) NOT NULL,
    owner_employee_id VARCHAR(64) NOT NULL,
    owner_name VARCHAR(128) NOT NULL,
    priority VARCHAR(32) NOT NULL DEFAULT 'High' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_date DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'In Progress' CHECK (status IN ('Draft', 'In Progress', 'Completed', 'On Hold', 'Cancelled')),
    current_department_id VARCHAR(64) NOT NULL,
    current_department_name VARCHAR(128) NOT NULL,
    current_stage_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_projects_organization_id ON team_projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_projects_current_department ON team_projects(current_department_id);

-- -------------------------------------------------------------
-- 7. PROJECT STAGES TABLE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES team_projects(id) ON DELETE CASCADE,
    department_id VARCHAR(64) NOT NULL,
    department_name VARCHAR(128) NOT NULL,
    department_color VARCHAR(32) DEFAULT '#6366f1',
    sequence INTEGER NOT NULL,
    assigned_employee_id VARCHAR(64),
    assigned_employee_name VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'Locked' CHECK (status IN ('Pending', 'Active', 'Completed', 'Returned', 'Locked')),
    start_date DATE,
    due_date DATE,
    completed_date DATE,
    progress INTEGER NOT NULL DEFAULT 0,
    submission_notes TEXT,
    return_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_stages_project_id ON project_stages(project_id);

-- -------------------------------------------------------------
-- 8. WORKFLOW TEMPLATES TABLE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(64) NOT NULL,
    estimated_days INTEGER NOT NULL DEFAULT 14,
    departments JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- 9. SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation RLS for tasks
CREATE POLICY tenant_isolation_tasks_select ON tasks
    FOR SELECT
    USING (organization_id = auth.jwt() ->> 'organization_id' OR (auth.jwt() ->> 'role') = 'super_admin');

CREATE POLICY tenant_isolation_tasks_insert ON tasks
    FOR INSERT
    WITH CHECK (organization_id = auth.jwt() ->> 'organization_id' OR (auth.jwt() ->> 'role') = 'super_admin');

CREATE POLICY tenant_isolation_tasks_update ON tasks
    FOR UPDATE
    USING (organization_id = auth.jwt() ->> 'organization_id' OR (auth.jwt() ->> 'role') = 'super_admin');

CREATE POLICY tenant_isolation_tasks_delete ON tasks
    FOR DELETE
    USING (organization_id = auth.jwt() ->> 'organization_id' OR (auth.jwt() ->> 'role') = 'super_admin');

-- Projects Tenant RLS
CREATE POLICY tenant_isolation_projects ON team_projects
    FOR ALL
    USING (organization_id = auth.jwt() ->> 'organization_id' OR (auth.jwt() ->> 'role') = 'super_admin');
