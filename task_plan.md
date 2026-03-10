# PHC Inventory v2 — Task Plan

## Phase 0: Initialization ✅
- [x] Read blasting-automations skill
- [x] Create GitHub repo (`aaron-creations/phc-inventory-v2`)
- [x] Initialize B.L.A.S.T. project files
- [x] Parse and record CSV seed data

## Phase 1: Blueprint ✅
- [x] North Star defined
- [x] Integrations confirmed (Supabase + GitHub + Vercel)
- [x] Data schema defined in `gemini.md`
- [x] Behavioral rules established
- [x] Full app audit completed (all screens documented)

## Phase 2: Link 🟡
- [ ] Scaffold React + Vite + Tailwind CSS v3 locally at `H:\My Drive\PHC_Inventory_v2\`
- [ ] Create Supabase project + apply schema migration
- [ ] Verify Supabase connection from app (`.env` keys confirmed)
- [ ] Seed database with 25 products + 3 blends + 1 technician
- [ ] Import 9 transactions from CSV

## Phase 3: Architect — Core App Build ⬜
### Architecture SOPs (write before coding)
- [x] 01_database_schema.md
- [x] 02_auth_flow.md
- [x] 03_logging_flow.md
- [x] 04_stock_calculation.md

### React Components
- [ ] Main Dashboard (technician list, blend badges, date)
- [ ] Technician Logging Flow (Blend + Single modes)
- [ ] Stock Levels view (progress bars, search, color-coded)
- [ ] Mix Rates Reference Guide
- [ ] Manager Panel shell + sidebar nav
- [ ] Manager: Dashboard (KPIs + activity feed)
- [ ] Manager: Inventory table with cost tracking
- [ ] Manager: Blends editor (view/create/edit/delete)
- [ ] Manager: Transaction History + CSV export
- [ ] Manager: Team Management
- [ ] Manager: Settings (Supabase Auth)
- [ ] Manager: Log Usage modal
- [ ] Manager: Log Restock modal (vendor + invoice)

## ⛔ USER REVIEW GATE — Core App Complete
> Build pauses here. User reviews all screens before any enhancement begins.

## Phase 4: Stylize — Enhancements (Step-by-Step) ⬜
> Each enhancement below requires user review + approval before implementation.
- [ ] Enhancement 1: 📊 Analytics Dashboard (charts: usage over time, by tech, by product)
- [ ] Enhancement 2: 🔔 Low-Stock Alert System (configurable thresholds, banners)
- [ ] Enhancement 3: 👤 Per-Technician Summary (weekly/monthly stats)
- [ ] Enhancement 4: 💰 Blend Cost Calculator (realized cost per application)
- [ ] Enhancement 5: 📍 Job / Location Tagging (attach logs to customer/job site)
- [ ] Enhancement 6: 📱 PWA / Installable App (mobile home screen, offline fallback)

## Phase 5: Trigger — Deploy ⬜
- [ ] Deploy to Vercel
- [ ] Configure Supabase env vars in Vercel dashboard
- [ ] Final QA (browser subagent walkthrough)
- [ ] Hand off URL + manager credentials to nephew
- [ ] Provide data migration guide for nephew's existing data
