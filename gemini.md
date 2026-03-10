# 🧠 gemini.md — Project Constitution
> **This file is LAW.** All schemas, rules, and architectural invariants live here.
> Update ONLY when: a schema changes, a rule is added, or architecture is modified.

---

## 📋 Project Overview

| Field | Value |
|-------|-------|
| **Project Name** | PHC Inventory v2 — Plant Health Care Operations App |
| **System Pilot** | Antigravity (B.L.A.S.T. Protocol) |
| **Protocol** | B.L.A.S.T. + A.N.T. 3-Layer Architecture |
| **Stack** | React + Vite + Tailwind CSS v3 + Supabase |
| **Status** | 🟢 Phase 2 — Link (Scaffolding + DB Setup) |
| **Created** | 2026-03-10 |
| **Last Updated** | 2026-03-10 |

---

## 🗺️ B.L.A.S.T. Phase Tracker

| Phase | Name | Status |
|-------|------|--------|
| 0 | Initialization | ✅ Complete |
| 1 | Blueprint | ✅ Complete — Discovery Answered |
| 2 | Link | 🟡 In Progress — Supabase + GitHub connected |
| 3 | Architect | ⬜ Pending — Core app build |
| 4 | Stylize | ⬜ Pending — Enhancements (step-by-step with user) |
| 5 | Trigger | ⬜ Pending — Vercel deployment |

---

## 🎯 North Star (Singular Desired Outcome)

> A production-ready v2 of the PHC Inventory app for a Plant Health Care business. Faithfully recreates all original functionality, then adds analytics dashboards, low-stock alerts, per-technician summaries, blend cost tracking, and job/location tagging. Deployed on Vercel and handed off to the nephew (original app author) as a meaningful upgrade.

---

## 📐 Data Schema

### Supabase Tables

#### `products`
```json
{
  "id": "uuid",
  "name": "string",
  "category": "string",
  "mix_rate": "string (e.g. '64 fl oz/100 gal' or 'Direct')",
  "unit_type": "enum: direct | mixed",
  "container_size": "number",
  "container_unit": "string (pint, gal, qt, liter, oz)",
  "containers_in_stock": "number (decimal)",
  "cost_per_container": "number (USD)",
  "low_stock_threshold": "number (containers, default 0.5)",
  "created_at": "timestamp"
}
```

#### `blends`
```json
{
  "id": "uuid",
  "name": "string",
  "badge_color": "string",
  "emoji": "string",
  "created_at": "timestamp"
}
```

#### `blend_components`
```json
{
  "id": "uuid",
  "blend_id": "uuid → blends.id",
  "product_id": "uuid → products.id",
  "rate_fl_oz_per_100_gal": "number"
}
```

#### `technicians`
```json
{
  "id": "uuid",
  "first_name": "string",
  "last_initial": "string",
  "color_hex": "string",
  "created_at": "timestamp"
}
```

#### `jobs`
```json
{
  "id": "uuid",
  "customer_name": "string",
  "address": "string (optional)",
  "notes": "string (optional)",
  "created_at": "timestamp"
}
```

#### `transactions`
```json
{
  "id": "uuid",
  "type": "enum: USAGE | RESTOCK | BLEND",
  "technician_id": "uuid → technicians.id (nullable)",
  "product_id": "uuid → products.id (nullable for BLEND)",
  "blend_id": "uuid → blends.id (nullable for USAGE/RESTOCK)",
  "job_id": "uuid → jobs.id (optional)",
  "amount": "number",
  "unit": "string",
  "estimated_cost": "number (USD)",
  "vendor": "string (optional)",
  "invoice_notes": "string (optional)",
  "date": "date",
  "created_at": "timestamp"
}
```

#### `settings`
```json
{
  "key": "string (primary key)",
  "value": "string"
}
```

---

## 🔗 Integrations & Services

| Service | Purpose | Status |
|---------|---------|--------|
| **Supabase** | Database + Auth | ✅ Account created |
| **GitHub** | Version control | ✅ `aaron-creations/phc-inventory-v2` |
| **Vercel** | Deployment | ⬜ Pending Phase 5 |

---

## 📏 Behavioral Rules

1. **No lorem ipsum.** All product/blend names must be real PHC data from CSV.
2. **Data-first.** No components built without schema finalized.
3. **Stop before enhancements.** Core app is built and user-reviewed BEFORE Phase 4.
4. **Enhancements are step-by-step.** Each enhancement is reviewed and approved individually.
5. **CSV data is sacred.** The transactions from `PHC_Inventory.csv` are seed truth.
6. **Security upgrade.** 4-digit PIN replaced with Supabase Auth.
7. **No hardcoded credentials.** All Supabase keys live in `.env` only.

---

## 🏗️ Architectural Invariants

1. **A.N.T. 3-Layer:** SOPs in `architecture/` before code is written.
2. **Tools are deterministic.** Seed scripts in `tools/` are atomic and testable.
3. **`.tmp/` is ephemeral.** Never treat temp files as source of truth.
4. **`.env` holds all secrets.** No credentials hardcoded anywhere.
5. **Self-Annealing Loop:** Errors → Patch → Test → Update SOP.
6. **Enhancement gate.** Build pauses after core app for user design review.

---

## 📁 Filesystem Map

```
gemini.md              # Project Constitution
.env                   # Secrets (never commit)
.env.example           # Secret template
architecture/          # Layer 1: SOPs
  01_database_schema.md
  02_auth_flow.md
  03_logging_flow.md
  04_stock_calculation.md
tools/                 # Layer 3: Seed + migration scripts
  seed_database.js
  import_csv.js
src/                   # React app source
.tmp/                  # Ephemeral workbench
task_plan.md
findings.md
progress.md
```

---

## 🔧 Maintenance Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-10 | Protocol 0 complete — repo created, CSV parsed, B.L.A.S.T. structure pushed | System Pilot |
