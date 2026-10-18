# OutcomeX — Department Pilot & Production Deployment Guide

This guide describes how to deploy OutcomeX for an engineering college department pilot (e.g. Department of Computer Science & Engineering, Priyadarshini College of Engineering, Nagpur).

---

## 1. System Architecture Overview

```mermaid
graph TD
    TeacherBrowser["Teacher / HOD Browser"] -->|HTTPS| NextApp["Next.js Application (App Router)"]
    NextApp -->|Supabase Auth / SSR| SupabaseAuth["Supabase Authentication"]
    NextApp -->|Parameterized SQL + RLS| SupabaseDB["PostgreSQL Database (19 Tables)"]
    NextApp -->|Child Process / API| PythonEngine["Python 3.10+ openpyxl Service"]
    PythonEngine -->|Read Only (SHA-256 Verified)| Template["Reference Excel Template"]
    PythonEngine -->|Byte-Exact Gen| OutputXlsx["Generated College Workbooks (.xlsx)"]
```

---

## 2. Infrastructure Requirements

| Component | Minimum Requirement | Recommended (Department Pilot) |
|---|---|---|
| **Node.js** | v20.x or v22.x LTS | v22.16.0 LTS |
| **Python** | Python 3.10+ | Python 3.11+ with `openpyxl==3.1.5` |
| **Database** | PostgreSQL 15+ (Supabase Managed or Self-Hosted) | Supabase Pro / Free Tier PostgreSQL 15 |
| **RAM** | 2 GB | 4 GB |
| **Storage** | 10 GB SSD | 20 GB NVMe SSD |
| **Operating System** | Windows Server, Ubuntu 22.04 LTS, or Debian 12 | Ubuntu 22.04 LTS / Windows 11 |

---

## 3. Database Setup & Migrations

OutcomeX comes with three ordered SQL migrations in `supabase/migrations/`:

1. `20261018000001_initial_schema.sql` (Creates 19 core entities, triggers, and indexes).
2. `20261018000002_rls_policies.sql` (Enables Row Level Security on all 19 entities with strict role isolation).
3. `20261018000003_seed_reference_data.sql` (Seeds CSE department, 2025-26 academic year, 12 POs, 2 PSOs, and 81 students).

### Applying Migrations via Supabase CLI

```bash
# Login to Supabase CLI
npx supabase login

# Link to your Supabase project
npx supabase link --project-ref <your-project-id>

# Push migrations
npx supabase db push
```

### Applying Migrations via Supabase SQL Editor
If using the Supabase Web Dashboard:
1. Navigate to **SQL Editor**.
2. Run `20261018000001_initial_schema.sql`.
3. Run `20261018000002_rls_policies.sql`.
4. Run `20261018000003_seed_reference_data.sql`.

---

## 4. Environment Variables Configuration

Create a `.env.local` (for development) or `.env.production` (for production) file in the project root:

```ini
# Supabase Configuration (Client-safe)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...<your-anon-key>

# Supabase Service Role Key (SERVER-ONLY — NEVER prefix with NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...<your-service-role-key>

# Application Configuration
NEXT_PUBLIC_APP_URL=https://outcomex.pce.edu.in
PORT=3000
NODE_ENV=production
```

> [!CAUTION]
> Never commit `.env.local` or `.env.production` to source control. Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`.

---

## 5. Python Runtime Dependencies

The Excel generation service requires Python 3.10+ and `openpyxl`:

```bash
# Verify Python installation
python --version

# Install required packages
pip install openpyxl==3.1.5
```

---

## 6. Building and Running the Application

### Production Build
```bash
# Install dependencies
npm ci

# Typecheck and build production bundle
npm run build

# Start production server
npm run start
```

### Process Management with PM2 (Linux/Windows Server)
```bash
# Install PM2 globally
npm install -g pm2

# Start OutcomeX
pm2 start npm --name "outcomex" -- run start

# Save process list for system reboot
pm2 save
pm2 startup
```

---

## 7. Backup and Recovery

### PostgreSQL Automated Backups
- Supabase automatically takes daily backups.
- For local pg_dump backup:
```bash
pg_dump -h db.<your-project>.supabase.co -U postgres -d postgres -F c -b -v -f outcomex_backup_$(date +%Y%m%d).dump
```

### Export Directory Maintenance
- Generated `.xlsx` files are stored in `exports/`.
- Maintain a cron job or scheduled task to prune export files older than 90 days if storage is constrained.

---

## 8. Pilot Rollout Checklist

- [ ] All 3 Supabase migrations executed successfully without errors.
- [ ] Department admin profile created with `role = 'HOD'`.
- [ ] Course coordinator profiles assigned to courses with `role = 'TEACHER'`.
- [ ] Program Outcomes (PO1–PO12) and PSOs configured and reviewed.
- [ ] Python openpyxl environment verified (`python scripts/excel_generator.py 60_40`).
- [ ] Health check endpoint (`/`) loads under 200ms.
- [ ] Test student marks import executed with sample data.
- [ ] Excel export tested; generated spreadsheet opens in Microsoft Excel without formula warnings or repair prompts.
