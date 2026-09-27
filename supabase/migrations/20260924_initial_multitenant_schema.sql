-- Migration: 20260924_initial_multitenant_schema.sql
-- Description: Multi-tenant SaaS Cluster setup with initial seed companies

-- Run schema definitions
\i ../schema.sql;

-- Insert Default Super Admin Organization
INSERT INTO tenants (
  tenant_id, company_name, legal_name, email, phone, address, city, state, country, gstin, industry,
  licensed_employees, subscription_plan, subscription_start_date, subscription_end_date, payment_status, status,
  login_slug, client_code
) VALUES 
(
  'NP-000001', 'NovaPulse Infotech Solutions Pvt Ltd', 'NovaPulse Infotech Solutions Private Limited',
  'contact@novapulse.co.in', '+91 98111 00001', 'Sector 62, Electronic City', 'Noida', 'Uttar Pradesh', 'India',
  '07AAAAA0000A1Z5', 'Information Technology', 50, 'Annual', '2026-01-01', '2026-12-31', 'PAID', 'ACTIVE',
  'app.novapulse.co.in/login?tenant=NP-000001', 'NOVAPULSE'
),
(
  'NP-000002', 'Apex Health & Diagnostics', 'Apex Healthcare Services LLP',
  'admin@apexdiagnostics.in', '+91 98222 00002', 'Connaught Place', 'New Delhi', 'Delhi', 'India',
  '07BBBBB1111B1Z6', 'Healthcare & Pharmaceuticals', 25, 'Monthly', '2026-08-01', '2026-08-31', 'PAID', 'ACTIVE',
  'app.novapulse.co.in/login?tenant=NP-000002', 'APEX'
),
(
  'NP-000003', 'Zenith Logistics & Supply Chain', 'Zenith Express Logistics India Ltd',
  'ops@zenithlogistics.com', '+91 98333 00003', 'Bhiwandi Cargo Complex', 'Thane', 'Maharashtra', 'India',
  '27CCCCC2222C1Z7', 'Logistics & Supply Chain', 100, 'Enterprise Custom', '2026-06-01', '2027-05-31', 'PAID', 'ACTIVE',
  'app.novapulse.co.in/login?tenant=NP-000003', 'ZENITH'
),
(
  'NP-000004', 'Starlight Media & Entertainment', 'Starlight Creative Media LLP',
  'hr@starlightmedia.in', '+91 98444 00004', 'Andheri West', 'Mumbai', 'Maharashtra', 'India',
  '27DDDDD3333D1Z8', 'Media & Entertainment', 15, 'Trial', '2026-09-01', '2026-09-30', 'WAIVED', 'TRIAL',
  'app.novapulse.co.in/login?tenant=NP-000004', 'STARLIGHT'
),
(
  'NP-000005', 'Quantum FinTech Labs', 'Quantum Capital Financial Services Pvt Ltd',
  'accounts@quantumfintech.io', '+91 98555 00005', 'Cyber City, DLF Phase 2', 'Gurugram', 'Haryana', 'India',
  '06EEEEE4444E1Z9', 'Financial Services & FinTech', 35, 'Monthly', '2026-07-15', '2026-08-15', 'OVERDUE', 'ON_HOLD',
  'app.novapulse.co.in/login?tenant=NP-000005', 'QUANTUM'
),
(
  'NP-000006', 'Silaris Information Technologies Pvt Ltd', 'Silaris Information Technologies Private Limited',
  'admin@silaris.in', '+91 98111 55667', 'A-24/5, Mohan Cooperative Industrial Estate, Mathura Road', 'New Delhi', 'Delhi', 'India',
  '07AAACS5678Q1Z2', 'Information Technology & BPO', 50, 'Annual', '2026-09-24', '2027-09-23', 'PAID', 'ACTIVE',
  'https://silaris.makemypayroll.com', 'SILARIS'
)
ON CONFLICT (tenant_id) DO NOTHING;
