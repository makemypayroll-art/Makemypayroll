-- ====================================================================
-- NOVAPULSE HRMS — COMPLETE MULTI-TENANT SAAS SUPABASE SCHEMA & RLS
-- ONE SINGLE SUPABASE PROJECT FOR ENTIRE SAAS PLATFORM
-- ====================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------
-- 1. ENUMS & DOMAINS
-- -------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role_level AS ENUM ('super_admin', 'client_admin', 'manager', 'employee');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tenant_status_type AS ENUM (
    'ACTIVE', 'TRIAL', 'PAYMENT_PENDING', 'ON_HOLD', 'SUSPENDED', 'CANCELLED', 'ARCHIVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_plan_type AS ENUM (
    'Trial', 'Monthly', 'Quarterly', 'Half-Yearly', 'Annual', 'Enterprise Custom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status_type AS ENUM (
    'PAID', 'PARTIALLY_PAID', 'PENDING', 'OVERDUE', 'WAIVED', 'REFUNDED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------------
-- 2. CORE TABLE: TENANTS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) UNIQUE NOT NULL, -- e.g. "NP-000001"
  company_name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  address TEXT,
  city VARCHAR(128) DEFAULT 'Noida',
  state VARCHAR(128) DEFAULT 'Uttar Pradesh',
  country VARCHAR(128) DEFAULT 'India',
  gstin VARCHAR(64),
  industry VARCHAR(128) DEFAULT 'Information Technology',
  licensed_employees INT NOT NULL DEFAULT 20 CHECK (licensed_employees > 0),
  subscription_plan subscription_plan_type NOT NULL DEFAULT 'Monthly',
  subscription_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subscription_end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  payment_status payment_status_type NOT NULL DEFAULT 'PAID',
  status tenant_status_type NOT NULL DEFAULT 'ACTIVE',
  login_slug VARCHAR(128) UNIQUE NOT NULL, -- e.g. "https://novapulse.pulsebazar.shop"
  slug VARCHAR(64) UNIQUE, -- e.g. "ignite", "razor"
  client_code VARCHAR(32) NOT NULL, -- e.g. "INFOTECH"
  custom_domain VARCHAR(255),
  logo_url TEXT,
  brand_color VARCHAR(32) DEFAULT '#9333ea',
  hold_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_tenant_id ON tenants (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants (slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants (status);

-- -------------------------------------------------------------
-- 3. CORE TABLE: USER_PROFILES (Linked to Supabase Auth)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE, -- REFERENCES auth.users(id) ON DELETE CASCADE
  tenant_id VARCHAR(32) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  employee_id VARCHAR(64),
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role_level NOT NULL DEFAULT 'employee',
  avatar_url TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON user_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles (email);

-- Backward compatibility view if referenced as tenant_users
CREATE OR REPLACE VIEW tenant_users AS SELECT * FROM user_profiles;

-- -------------------------------------------------------------
-- 4. CORE TABLE: DEPARTMENTS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(32) NOT NULL,
  head_employee_id VARCHAR(64),
  description TEXT,
  parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unq_dept_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_departments_tenant_id ON departments (tenant_id);

-- -------------------------------------------------------------
-- 5. CORE TABLE: BRANCHES
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(32) NOT NULL,
  address TEXT,
  city VARCHAR(128) NOT NULL,
  state VARCHAR(128) NOT NULL,
  country VARCHAR(128) NOT NULL DEFAULT 'India',
  pincode VARCHAR(32),
  is_head_office BOOLEAN NOT NULL DEFAULT FALSE,
  geo_fence JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unq_branch_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_branches_tenant_id ON branches (tenant_id);

-- -------------------------------------------------------------
-- 6. CORE TABLE: SHIFTS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(32) NOT NULL,
  start_time TIME NOT NULL DEFAULT '09:00:00',
  end_time TIME NOT NULL DEFAULT '18:00:00',
  grace_minutes INT NOT NULL DEFAULT 15,
  break_minutes INT NOT NULL DEFAULT 60,
  work_hours NUMERIC(4,2) NOT NULL DEFAULT 9.0,
  is_night_shift BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unq_shift_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_shifts_tenant_id ON shifts (tenant_id);

-- -------------------------------------------------------------
-- 7. CORE TABLE: EMPLOYEES (With Hard Licence Capacity Constraint)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  employee_code VARCHAR(64) NOT NULL,
  first_name VARCHAR(128) NOT NULL,
  last_name VARCHAR(128) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(64),
  personal_email VARCHAR(255),
  dob DATE,
  gender VARCHAR(32),
  joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
  employment_type VARCHAR(64) NOT NULL DEFAULT 'Full-time',
  employment_status VARCHAR(64) NOT NULL DEFAULT 'Active', -- 'Active', 'Probation', 'Notice', 'Resigned', 'Terminated'
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  designation_id VARCHAR(64),
  reporting_manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  salary_structure JSONB DEFAULT '{}'::jsonb,
  bank_details JSONB DEFAULT '{}'::jsonb,
  statutory_details JSONB DEFAULT '{}'::jsonb,
  emergency_contact JSONB DEFAULT '{}'::jsonb,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unq_emp_tenant_code UNIQUE (tenant_id, employee_code),
  CONSTRAINT unq_emp_tenant_email UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees (tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_status ON employees (tenant_id, employment_status);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees (reporting_manager_id);

-- -------------------------------------------------------------
-- 8. DATABASE TRIGGER: STRICT EMPLOYEE LICENCE LIMIT ENFORCEMENT
-- Enforced at the PostgreSQL level to prevent any breach.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_tenant_licence_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_licence_limit INT;
  v_active_count INT;
  v_tenant_status tenant_status_type;
BEGIN
  -- 1. Check Tenant Status: If On Hold or Suspended, block modifications
  SELECT status, licensed_employees INTO v_tenant_status, v_licence_limit
  FROM tenants
  WHERE tenant_id = NEW.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant % does not exist in registry.', NEW.tenant_id;
  END IF;

  IF v_tenant_status IN ('ON_HOLD', 'SUSPENDED', 'CANCELLED', 'ARCHIVED') THEN
    RAISE EXCEPTION 'Tenant % is currently %: Employee operations blocked while account is on hold.', NEW.tenant_id, v_tenant_status;
  END IF;

  -- 2. Count active employees for this tenant
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.employment_status NOT IN ('Active', 'Probation', 'Notice') AND NEW.employment_status IN ('Active', 'Probation', 'Notice')) THEN
    IF NEW.employment_status IN ('Active', 'Probation', 'Notice') THEN
      SELECT COUNT(*) INTO v_active_count
      FROM employees
      WHERE tenant_id = NEW.tenant_id
        AND employment_status IN ('Active', 'Probation', 'Notice')
        AND (TG_OP = 'INSERT' OR id <> NEW.id);

      IF (v_active_count + 1) > v_licence_limit THEN
        RAISE EXCEPTION 'Licence quota exceeded for Tenant %: Capacity is % seats, currently using % active seats. Please upgrade licences in Super Admin Panel.',
          NEW.tenant_id, v_licence_limit, v_active_count;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_tenant_licence_limit ON employees;
CREATE TRIGGER trg_check_tenant_licence_limit
  BEFORE INSERT OR UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION enforce_tenant_licence_limit();

-- -------------------------------------------------------------
-- 9. CORE TABLE: SUBSCRIPTIONS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  plan_name subscription_plan_type NOT NULL DEFAULT 'Monthly',
  billing_cycle VARCHAR(64) NOT NULL DEFAULT 'Monthly',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  licensed_employees INT NOT NULL DEFAULT 20,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(16) NOT NULL DEFAULT 'INR',
  payment_status payment_status_type NOT NULL DEFAULT 'PAID',
  renewal_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions (tenant_id);

-- -------------------------------------------------------------
-- 10. CORE TABLE: TENANT_LICENSES (Audit & Quota Tracking)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  previous_limit INT NOT NULL,
  new_limit INT NOT NULL,
  changed_by VARCHAR(255) NOT NULL DEFAULT 'Super Admin',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_licenses_tenant_id ON tenant_licenses (tenant_id);

-- Backward compatibility view if referenced as licences
CREATE OR REPLACE VIEW licences AS SELECT * FROM tenant_licenses;

-- -------------------------------------------------------------
-- 11. CORE TABLE: ATTENDANCE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'Present',
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  check_in_ip VARCHAR(64),
  check_out_ip VARCHAR(64),
  work_hours NUMERIC(4,2) DEFAULT 0.0,
  overtime_hours NUMERIC(4,2) DEFAULT 0.0,
  late_minutes INT DEFAULT 0,
  early_departure_minutes INT DEFAULT 0,
  location_check_in JSONB,
  location_check_out JSONB,
  regularization JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unq_attendance_emp_date UNIQUE (tenant_id, employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_tenant_id ON attendance (tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance (tenant_id, employee_id, date);

-- -------------------------------------------------------------
-- 12. CORE TABLE: LEAVE REQUESTS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(64) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(4,1) NOT NULL DEFAULT 1.0,
  reason TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant_id ON leave_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests (tenant_id, employee_id);

-- -------------------------------------------------------------
-- 13. CORE TABLE: TICKETS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  ticket_number VARCHAR(64) NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category VARCHAR(64) NOT NULL DEFAULT 'IT',
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(32) NOT NULL DEFAULT 'Medium',
  status VARCHAR(32) NOT NULL DEFAULT 'Open',
  assigned_to_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unq_ticket_tenant_num UNIQUE (tenant_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id ON tickets (tenant_id);

-- -------------------------------------------------------------
-- 14. CORE TABLE: INVENTORY
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  asset_tag VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'Laptop',
  serial_number VARCHAR(128),
  make_model VARCHAR(128),
  purchase_date DATE,
  purchase_price NUMERIC(12,2) DEFAULT 0.00,
  condition VARCHAR(64) NOT NULL DEFAULT 'Good',
  status VARCHAR(64) NOT NULL DEFAULT 'Available',
  allocated_to_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  allocation_date DATE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unq_inventory_tenant_tag UNIQUE (tenant_id, asset_tag)
);

CREATE INDEX IF NOT EXISTS idx_inventory_tenant_id ON inventory (tenant_id);

-- -------------------------------------------------------------
-- 15. CORE TABLE: PAYROLL
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  payroll_month INT NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
  year INT NOT NULL CHECK (year >= 2020),
  basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  hra NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  conveyance_allowance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  special_allowance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  gross_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  epf_deduction NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  esi_deduction NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  tax_deduction NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  net_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(32) NOT NULL DEFAULT 'Draft',
  payment_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unq_payroll_tenant_emp_month UNIQUE (tenant_id, employee_id, payroll_month, year)
);

CREATE INDEX IF NOT EXISTS idx_payroll_tenant_id ON payroll (tenant_id);

-- -------------------------------------------------------------
-- 16. CORE TABLE: AUDIT_LOGS (Immutable Activity Trail)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_role VARCHAR(64) NOT NULL,
  module VARCHAR(128) NOT NULL,
  action VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  record_id VARCHAR(64),
  previous_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(64) DEFAULT '127.0.0.1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- -------------------------------------------------------------
-- 17. CORE TABLE: NOTIFICATIONS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(32) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (tenant_id, user_id, is_read);

-- =============================================================
-- ROW LEVEL SECURITY (RLS) & HELPER FUNCTIONS
-- =============================================================

-- Helper function: Get Auth User Role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role_level AS $$
DECLARE
  v_role user_role_level;
BEGIN
  SELECT role INTO v_role
  FROM user_profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  RETURN COALESCE(v_role, 'employee'::user_role_level);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Get Auth User Tenant ID
CREATE OR REPLACE FUNCTION get_current_user_tenant_id()
RETURNS VARCHAR(32) AS $$
DECLARE
  v_tenant_id VARCHAR(32);
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM user_profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if caller is Super Admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (get_current_user_role() = 'super_admin'::user_role_level);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Get Auth User Linked Employee ID
CREATE OR REPLACE FUNCTION get_current_user_employee_id()
RETURNS UUID AS $$
DECLARE
  v_emp_id UUID;
BEGIN
  SELECT e.id INTO v_emp_id
  FROM employees e
  JOIN user_profiles up ON up.employee_id = e.employee_code AND up.tenant_id = e.tenant_id
  WHERE up.auth_user_id = auth.uid()
  LIMIT 1;
  RETURN v_emp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- RLS POLICIES FOR TENANTS
-- -------------------------------------------------------------
DROP POLICY IF EXISTS p_tenants_super_admin ON tenants;
CREATE POLICY p_tenants_super_admin ON tenants
  FOR ALL
  USING (is_super_admin());

DROP POLICY IF EXISTS p_tenants_client_read ON tenants;
CREATE POLICY p_tenants_client_read ON tenants
  FOR SELECT
  USING (tenant_id = get_current_user_tenant_id());

-- Allow public resolution of active/non-archived tenant workspaces for subdomain routing
DROP POLICY IF EXISTS p_tenants_public_read ON tenants;
CREATE POLICY p_tenants_public_read ON tenants
  FOR SELECT
  TO anon, authenticated
  USING (status NOT IN ('ARCHIVED'));

-- Security Definer RPC for Canonical Tenant Resolution
CREATE OR REPLACE FUNCTION get_tenant_by_subdomain(p_slug TEXT)
RETURNS SETOF tenants AS $$
  SELECT * FROM tenants
  WHERE (
    LOWER(slug) = LOWER(TRIM(p_slug))
    OR tenant_id = TRIM(p_slug)
    OR LOWER(client_code) = LOWER(TRIM(p_slug))
  )
  AND status NOT IN ('ARCHIVED')
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- -------------------------------------------------------------
-- RLS POLICIES FOR USER_PROFILES
-- -------------------------------------------------------------
DROP POLICY IF EXISTS p_user_profiles_super_admin ON user_profiles;
CREATE POLICY p_user_profiles_super_admin ON user_profiles
  FOR ALL
  USING (is_super_admin());

DROP POLICY IF EXISTS p_user_profiles_tenant ON user_profiles;
CREATE POLICY p_user_profiles_tenant ON user_profiles
  FOR ALL
  USING (tenant_id = get_current_user_tenant_id());

-- -------------------------------------------------------------
-- RLS POLICIES FOR EMPLOYEES
-- -------------------------------------------------------------
DROP POLICY IF EXISTS p_employees_super_admin ON employees;
CREATE POLICY p_employees_super_admin ON employees
  FOR ALL
  USING (is_super_admin());

DROP POLICY IF EXISTS p_employees_client_admin ON employees;
CREATE POLICY p_employees_client_admin ON employees
  FOR ALL
  USING (
    tenant_id = get_current_user_tenant_id() 
    AND get_current_user_role() = 'client_admin'::user_role_level
  );

DROP POLICY IF EXISTS p_employees_manager ON employees;
CREATE POLICY p_employees_manager ON employees
  FOR SELECT
  USING (
    tenant_id = get_current_user_tenant_id()
    AND (
      get_current_user_role() = 'manager'::user_role_level
      OR reporting_manager_id = get_current_user_employee_id()
      OR id = get_current_user_employee_id()
    )
  );

DROP POLICY IF EXISTS p_employees_self ON employees;
CREATE POLICY p_employees_self ON employees
  FOR SELECT
  USING (
    tenant_id = get_current_user_tenant_id()
    AND id = get_current_user_employee_id()
  );

-- -------------------------------------------------------------
-- RLS POLICIES FOR DEPARTMENTS, BRANCHES, SHIFTS
-- -------------------------------------------------------------
DROP POLICY IF EXISTS p_depts_super_admin ON departments;
CREATE POLICY p_depts_super_admin ON departments FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS p_depts_tenant ON departments;
CREATE POLICY p_depts_tenant ON departments FOR ALL USING (tenant_id = get_current_user_tenant_id());

DROP POLICY IF EXISTS p_branches_super_admin ON branches;
CREATE POLICY p_branches_super_admin ON branches FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS p_branches_tenant ON branches;
CREATE POLICY p_branches_tenant ON branches FOR ALL USING (tenant_id = get_current_user_tenant_id());

-- -------------------------------------------------------------
-- RLS POLICIES FOR SUBSCRIPTIONS & TENANT_LICENSES
-- -------------------------------------------------------------
DROP POLICY IF EXISTS p_subs_super_admin ON subscriptions;
CREATE POLICY p_subs_super_admin ON subscriptions FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS p_subs_tenant ON subscriptions;
CREATE POLICY p_subs_tenant ON subscriptions FOR SELECT USING (tenant_id = get_current_user_tenant_id());

DROP POLICY IF EXISTS p_licenses_super_admin ON tenant_licenses;
CREATE POLICY p_licenses_super_admin ON tenant_licenses FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS p_licenses_tenant ON tenant_licenses;
CREATE POLICY p_licenses_tenant ON tenant_licenses FOR SELECT USING (tenant_id = get_current_user_tenant_id());

-- -------------------------------------------------------------
-- RLS POLICIES FOR AUDIT LOGS
-- -------------------------------------------------------------
DROP POLICY IF EXISTS p_audit_super_admin ON audit_logs;
CREATE POLICY p_audit_super_admin ON audit_logs FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS p_audit_tenant ON audit_logs;
CREATE POLICY p_audit_tenant ON audit_logs FOR SELECT
  USING (tenant_id = get_current_user_tenant_id());
