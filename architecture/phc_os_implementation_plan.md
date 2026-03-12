# PHC OS — Full Implementation Plan

## Background & Where We Are Today

**MVP1 is complete and deployed.** The current app is a single-purpose inventory tool with:
- Supabase Auth (Google OAuth, Email/Password, Magic Link)
- RBAC (manager / technician / pending roles)
- 7 DB tables: `products`, `blends`, `blend_components`, `technicians`, `jobs`, `transactions`, `settings`
- The existing `jobs` table is a stub — 0 rows, no UI, and critically: **has RLS disabled, making it a hazard**

The direction is to expand into a **PHC OS** — a multi-app business operating system that unifies Inventory, CRM, Equipment Tracking, and Automations under a single roof.

> **This plan is ordered very deliberately.** Each phase lays the foundation the next phase depends on. Doing them out of order will cause rework. Do not skip phases.

---

## Why This Ordering Matters (The Dependency Chain)

```
Phase 1: App Launcher Shell
    ↓  (routing + RBAC must exist before anything new is added)
Phase 2: CRM Schema + Customer/Property UI
    ↓  (customers and properties must exist before jobs reference them)
Phase 3: Job Scheduling + Inventory Integration
    ↓  (jobs must exist before automations can trigger on job completion)
Phase 4: Automations (Twilio + Email Parser)
    ↓  (everything live before we add non-essential tracker)
Phase 5: Equipment Tracker + Analytics Dashboard
```

---

## Phase 1 — App Launcher Shell & Route Restructure
> **Goal:** Reorganize the app so users land on a `/hub` launcher page that routes them into the appropriate sub-app based on role. This is a pure architectural change — no new features, no new data.

### Why first?
Every new view we build needs a home. Without the Launcher in place first, we would add CRM routes in a messy, ad-hoc way and end up refactoring them later.

### What changes

#### Database
- None. No schema changes in Phase 1.

#### `src/App.jsx` [MODIFY]
- Add `/hub` route (the Launcher page, accessible to all approved roles)
- Change the `/` root redirect to point to `/hub` instead of directly to the Dashboard
- Existing routes (`/log`, `/stock`, `/mix-rates`, `/manager/*`) remain unchanged — they are now just "inside" the Inventory sub-app

#### `src/views/Hub/HubPage.jsx` [NEW]
- Post-login landing page
- Grid of large, touch-friendly app tiles:
  - 📦 **Inventory & Logs** → `/` (existing dashboard)
  - 🤝 **CRM & Customers** → `/crm` (built in Phase 2)
  - 🚜 **Fleet & Equipment** → `/fleet` (built in Phase 5) — shown but "Coming Soon" state until Phase 5
- Role-based tile visibility: technician sees Inventory + Fleet; manager sees all
- App-level persistent header/nav bar lives here

#### `src/components/ProtectedRoute.jsx` [MODIFY]
- Update redirect target from `/` to `/hub` for approved users

#### `src/contexts/AuthContext.jsx` [NO CHANGE]
- Auth context is already well-designed. No changes needed.

---

## Phase 2 — CRM: Database Schema + Customer & Property UI
> **Goal:** Build the complete CRM data model in Supabase and the Read/Write UI for Customers, Properties, and their Service History view. No scheduling yet — just the data management layer.

### Why before scheduling?
You cannot schedule a job for a customer who doesn't exist yet in the system.

### What changes

#### Database Migrations (Supabase)

> **NOTE:** The existing `jobs` table is a stub with no RLS and no UI. It will be replaced/superseded by the new CRM schema. We will NOT delete it immediately (it still FK-links to `transactions`), but it will be deprecated and superseded.

**New Table: `crm_customers`**
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
first_name    TEXT NOT NULL
last_name     TEXT
company_name  TEXT                          -- for commercial/HOA accounts
phone_mobile  TEXT
phone_home    TEXT
phone_office  TEXT
email         TEXT
lead_source   TEXT                          -- 'Website', 'Referral', 'Truck Wrap', etc.
status        TEXT DEFAULT 'lead'           -- 'lead' | 'active' | 'past' | 'inactive'
notes         TEXT
created_at    TIMESTAMPTZ DEFAULT now()
```

**New Table: `crm_properties`**
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
customer_id     UUID REFERENCES crm_customers(id) ON DELETE CASCADE
nickname        TEXT                         -- e.g. "Main House", "Office Building"
address_line1   TEXT NOT NULL
address_line2   TEXT
city            TEXT
state           TEXT
zip             TEXT
access_notes    TEXT                         -- gate codes, dogs, key locations
is_billing_addr BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
```

**New Table: `crm_jobs`**
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
property_id       UUID REFERENCES crm_properties(id) ON DELETE CASCADE
customer_id       UUID REFERENCES crm_customers(id) ON DELETE CASCADE
service_type      TEXT NOT NULL              -- 'Spring Fert', 'Dormant Oil', etc.
scheduled_date    DATE
status            TEXT DEFAULT 'scheduled'   -- 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
technician_id     UUID REFERENCES technicians(id)
quoted_price      NUMERIC
invoice_status    TEXT DEFAULT 'pending'     -- 'pending' | 'invoiced' | 'paid' | 'waived'
invoice_notes     TEXT
completion_notes  TEXT
review_sms_sent   BOOLEAN DEFAULT false
created_at        TIMESTAMPTZ DEFAULT now()
```

**Modify Table: `transactions`**
- Add column: `crm_job_id UUID REFERENCES crm_jobs(id)` (nullable — keeps backward compat with old logs)

**RLS Policies**
- All 3 new tables: managers have full CRUD; technicians can SELECT and UPDATE status on `crm_jobs` (to mark complete)

#### New Views/Components

**`src/views/CRM/CRMShell.jsx`** [NEW]
- Tabbed container (like ManagerPanel) with: Leads | Customers | Properties | Jobs

**`src/views/CRM/sections/LeadsSection.jsx`** [NEW]
- Table of all customers with `status = 'lead'`
- Action: "Convert to Customer" promotes status to 'active'
- Manual "Add Lead" form

**`src/views/CRM/sections/CustomersSection.jsx`** [NEW]
- Searchable table of all active customers
- Click-through to Customer Detail modal

**`src/views/CRM/CustomerDetail.jsx`** [NEW]
- Shows all contact info
- Lists all Properties for this customer (inline add/edit)
- Lists all `crm_jobs` records (read-only here, scheduled in Phase 3)
- Shows billing summary (quoted price, invoice status per job)

**`src/views/CRM/sections/PropertiesSection.jsx`** [NEW]
- Searchable table of all properties across all customers
- Useful for address-first lookups ("Where is 123 Main Street?")

---

## Phase 3 — Job Scheduling + Inventory Integration
> **Goal:** Connect the CRM Jobs to the existing Inventory Logging system so a technician's daily route drives their product usage logs.

### Why after Phase 2?
`crm_jobs` must exist before we can connect `transactions` to them.

### What changes

#### `src/views/CRM/sections/JobsSection.jsx` [NEW]
- Manager view: calendar or list of all upcoming `crm_jobs`
- Create/edit job modal (pick Customer → Property → Service Type → Date → Technician)
- Status pipeline: Scheduled → In Progress → Completed

#### `src/views/Logging/LoggingFlow.jsx` [MODIFY]
- Add optional step at the top of logging: "Link to a Job?"
- Dropdown of today's `crm_jobs` assigned to this technician (status = 'scheduled' or 'in_progress')
- If selected, writes `crm_job_id` to the `transactions` row
- On last product logged: prompt "Mark job as Complete?"

#### `src/views/Dashboard/Dashboard.jsx` [MODIFY]
- Add "Today's Route" card that shows this technician's scheduled `crm_jobs` for today
- Each job is a tap-to-start button that sets status to 'in_progress'

---

## Phase 4 — Automations: Twilio SMS + Email Lead Parser
> **Goal:** Add the two automations that make the CRM "intelligent" — auto-SMS on job completion (review harvester) and auto-ingest of leads from email.

### Why after Phase 3?
The review SMS triggers on job completion. Phase 3 is what establishes job completion. These automations are useless without the job lifecycle being operational first.

### What changes

#### Supabase Edge Function: `send-review-sms` [NEW]
- Triggered via Supabase DB Webhook when a `crm_jobs` row changes `status` to `'completed'` AND `review_sms_sent = false`
- Calls Twilio API to send SMS to `crm_customers.phone_mobile`
- Updates `review_sms_sent = true` to prevent duplicate sends

#### Supabase Edge Function: `ingest-lead` [NEW]
- Public endpoint (no JWT required — this is called by the email parser)
- Receives JSON: `{ name, phone, address, email, notes }`
- Validates basic structure
- Inserts new row into `crm_customers` with `status = 'lead'`
- Returns 200 OK

#### `src/views/Manager/sections/SettingsSection.jsx` [MODIFY]
- Add "Automations" subsection to existing Settings
- Fields: Twilio Account SID, Auth Token, Phone Number From (saved to `settings` table)
- Master toggle: Enable/Disable auto-review SMS

#### External Setup (Documented, not code)
- Zapier/SendGrid Email Parser setup instructions
- Nephew's inbox auto-forward rule setup instructions
- These are operational steps, not code commits

---

## Phase 5 — Equipment Tracker + Analytics Dashboard
> **Goal:** Add the Fleet module as a standalone "app" tile in the Launcher and complete the Analytics Dashboard that was in the original MVP2 backlog.

### What changes

#### Database Migrations

**New Table: `fleet_assets`**
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            TEXT NOT NULL               -- 'Truck 1', 'Chipper 2'
asset_type      TEXT                        -- 'truck' | 'chipper' | 'sprayer' | 'other'
year            TEXT
make            TEXT
model           TEXT
vin             TEXT
notes           TEXT
created_at      TIMESTAMPTZ DEFAULT now()
```

**New Table: `fleet_maintenance_schedules`**
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
asset_id        UUID REFERENCES fleet_assets(id) ON DELETE CASCADE
service_type    TEXT NOT NULL               -- 'Oil Change', 'Blade Sharpening'
interval_days   INTEGER                     -- e.g. 90 days
last_done_date  DATE
next_due_date   DATE GENERATED               -- last_done_date + interval_days
alert_sent      BOOLEAN DEFAULT false
```

#### New Views

**`src/views/Fleet/FleetShell.jsx`** [NEW]
- Asset list with maintenance status per asset (green/yellow/red based on due date proximity)

**`src/views/Fleet/sections/AssetDetail.jsx`** [NEW]
- All maintenance schedules for a given asset
- "Mark Done" button resets `last_done_date` to today

#### `src/views/Manager/sections/AnalyticsSection.jsx` [MODIFY]
- Previously a placeholder. Build it out with Recharts:
  - Usage over time (line chart by product or blend)
  - Cost breakdown (bar chart)
  - Per-technician summary
  - Date range filter

#### Supabase Edge Function: `fleet-maintenance-alert` [NEW]
- Runs on a daily schedule (Supabase Cron)
- Queries `fleet_maintenance_schedules` where `next_due_date <= now() + 7 days` AND `alert_sent = false`
- Sends alert email (via Supabase SMTP or Resend) to manager
- Sets `alert_sent = true`

---

## Verification Plan

> **NOTE:** There are no automated tests in the current codebase. All verification is browser-based and manual.

### Per Phase — Manual Verification Steps

**Phase 1 (Launcher):**
1. Log in as a Technician → confirm redirect lands on `/hub`
2. Confirm Inventory tile navigates to existing dashboard
3. Log in as Manager → confirm all tiles visible
4. Log in as Technician → confirm CRM tile is hidden (RBAC)

**Phase 2 (CRM Data):**
1. Add a new Customer (Lead status) → verify row appears in `crm_customers` in Supabase dashboard
2. Add a Property to that Customer → verify FK is correct
3. Convert Lead to Active → verify status updates
4. View Customer Detail → verify Properties and job history display correctly

**Phase 3 (Job + Inventory Integration):**
1. Manager creates a Job for a Customer/Property with Date = Today
2. Log in as Technician → confirm job appears in "Today's Route" on Dashboard
3. Tap "Start" → confirm status changes to `in_progress`
4. Open Logging Flow → confirm job appears in the "Link to Job" dropdown
5. Complete a log entry → verify `transactions` row has the correct `crm_job_id`
6. Mark job complete → verify `crm_jobs.status = 'completed'`

**Phase 4 (Automations):**
1. Mark a job complete → wait 30 seconds → verify the customer received a Twilio SMS (manually check)
2. Simulate an ingest-lead POST to the Edge Function URL (use Postman or browser DevTools) → verify new lead appears in CRM Leads section
3. Verify `review_sms_sent = true` in Supabase dashboard to confirm no duplicate sends

**Phase 5 (Equipment + Analytics):**
1. Add a fleet asset and a maintenance schedule
2. View asset list → confirm status indicator is correct
3. Manually fire the `fleet-maintenance-alert` function → verify email received
4. Open Analytics section → confirm charts render with real data from `transactions`

---

## What We Deliberately Are NOT Building (Yet)

| Feature | Reason Excluded |
|---------|-----------------|
| QuickBooks / invoice sync | Too complex; billing state-tracking is sufficient for now |
| Route optimization (mapping) | Heavy external API cost; out of scope for v1 CRM |
| Customer-facing portal | Requires separate auth flow; Phase 6+ |
| Multi-branch / franchise management | Too early; design for one branch first |
| Push Notifications | PWA is a prerequisite; Phase 5+ |
