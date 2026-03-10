# 🧠 gemini.md — Project Constitution
> **This file is LAW.** All schemas, rules, and architectural invariants live here.
> Update ONLY when: a schema changes, a rule is added, or architecture is modified.

---

## 📋 Project Overview

| Field | Value |
|-------|-------|
| **Project Name** | PHC Inventory v2 |
| **System Pilot** | Antigravity (B.L.A.S.T. Protocol) |
| **Protocol** | B.L.A.S.T. + A.N.T. 3-Layer Architecture |
| **Stack** | React + Vite + Tailwind CSS v3 + Supabase |
| **Status** | 🏁 MVP1 COMPLETE — Awaiting Vercel Deployment |
| **Created** | 2026-03-10 |
| **Last Updated** | 2026-03-10 |

---

## 🗺️ B.L.A.S.T. Phase Tracker

| Phase | Name | Status |
|-------|------|--------|
| 0 | Initialization | ✅ Complete |
| 1 | Blueprint | ✅ Complete |
| 2 | Link | ✅ Complete — Supabase connected, 7 tables seeded |
| 3 | Architect | ✅ Complete — All core screens built & verified |
| 4 | Stylize | ✅ Complete — Auth, RBAC, new logo, security hardening |
| 5 | Trigger | 🔄 In Progress — Vercel deployment |

---

## 🎯 North Star (Singular Desired Outcome)

> A fully functional PHC Inventory v2 app — rebuilt and enhanced — that the user's nephew can use to manage plant health care (PHC) product inventory, blend mix rates, and per-technician usage logs. The final deliverable is a deployed Vercel URL with Supabase backend.

---

## 🔗 Supabase Project

| Key | Value |
|-----|-------|
| **Project ID** | `jxydfmareguchcqelaiw` |
| **Project URL** | `https://jxydfmareguchcqelaiw.supabase.co` |
| **Dashboard** | https://supabase.com/dashboard/project/jxydfmareguchcqelaiw |
| **Auth Users** | https://supabase.com/dashboard/project/jxydfmareguchcqelaiw/auth/users |
| **Anon Key** | In `.env` file |

> ⚠️ Manager login uses Supabase Auth. A manager user must be manually created in the Auth dashboard before the Manager Panel can be accessed.

---

## 🗄️ Database Schema

| Table | Purpose |
|-------|---------|
| `products` | All 25 PHC products with stock levels, cost, mix rate |
| `blends` | 3 blend recipes (Spring Fert, Fall Fert, Mountain Pine Beetle) |
| `blend_components` | 10 rows linking blends → products with fl oz / 100 gal rates |
| `technicians` | Team members — currently: Kevin R. |
| `jobs` | (Phase 4 enhancement) Job/location tagging |
| `transactions` | All usage, restock, and blend application events |
| `settings` | Key-value store for app config (low stock threshold, etc.) |

---

## 📐 Data Schema

```json
{
  "products": {
    "id": "UUID",
    "name": "TEXT",
    "category": "TEXT",
    "mix_rate": "TEXT",
    "unit_type": "'direct' | 'mixed'",
    "container_size": "NUMERIC",
    "container_unit": "TEXT (gal, pint, qt, liter, oz)",
    "containers_in_stock": "NUMERIC",
    "cost_per_container": "NUMERIC | NULL",
    "low_stock_threshold": "NUMERIC"
  },
  "transactions": {
    "id": "UUID",
    "type": "'USAGE' | 'RESTOCK' | 'BLEND'",
    "technician_id": "UUID → technicians",
    "product_id": "UUID → products | NULL",
    "blend_id": "UUID → blends | NULL",
    "job_id": "UUID → jobs | NULL",
    "amount": "NUMERIC",
    "unit": "TEXT",
    "estimated_cost": "NUMERIC | NULL",
    "vendor": "TEXT | NULL",
    "invoice_notes": "TEXT | NULL",
    "date": "DATE"
  }
}
```

---

## 📏 Behavioral Rules ("The Do-Nots")

1. **No mock data.** All data comes from Supabase.
2. **Single-page feel.** Use React Router — no full page reloads.
3. **Stock decrements on log submit.** Every USAGE/BLEND transaction must update `containers_in_stock`.
4. **Never hardcode credentials.** All secrets live in `.env`. Never commit `.env`.
5. **Dev path = `C:\Projects\PHC_Inventory_v2`.** DO NOT use Google Drive for node_modules.
6. **All routes are protected.** Unauthenticated → `/login`. Pending role → `/access-pending`. Non-manager → blocked from `/manager/*`.
7. **RLS is active on all tables.** Use `get_my_role()` SECURITY DEFINER function for manager policy checks — never reference `user_profiles` recursively in its own policies.
8. **New users default to `pending` role.** Managers must explicitly approve in Manager → Users before access is granted.

---

## 🏗️ Dev Environment

```
Local dev:     C:\Projects\PHC_Inventory_v2
Dev server:    npm run dev  →  http://localhost:5174
GitHub:        https://github.com/aaron-creations/phc-inventory-v2
Supabase:      https://jxydfmareguchcqelaiw.supabase.co
```

---

## 📁 Filesystem Map

```
gemini.md              # This file — Project Constitution
handoff.md             # Ownership transfer guide for nephew
.env                   # Supabase URL + anon key (never commit)
.env.example           # Template for .env
public/
  phc-logo.png         # Circular badge logo (dark bg, white ring/text, green tree)
architecture/          # Layer 1: SOPs (Markdown How-Tos)
src/
  contexts/
    AuthContext.jsx    # Global auth state — session, profile, role, signOut
  components/
    ProtectedRoute.jsx # Route guards: ProtectedRoute, ManagerRoute, GuestRoute
    LowStockBanner.jsx # Stock alert banner component
  lib/
    supabaseClient.js  # Supabase singleton
  views/
    Login/
      LoginPage.jsx    # Landing login — Google OAuth + Email/Password/Magic Link
      AccessPending.jsx # Shown to users awaiting manager approval
    Dashboard/         # Main technician landing screen
    Logging/           # LoggingFlow — Single + Blend modes
    Stock/             # Stock Levels view with status filters
    MixRates/          # Mix Rates reference guide
    Manager/
      ManagerPanel.jsx # Shell with sidebar navigation (manager-only)
      sections/
        ManagerDashboard.jsx  # KPIs + recent activity
        AnalyticsSection.jsx  # Usage analytics
        InventorySection.jsx  # Product table
        BlendsSection.jsx     # Blend editor
        HistorySection.jsx    # Transactions + CSV export
        TeamSection.jsx       # Add/remove technicians
        UsersSection.jsx      # User approval + role assignment
        SettingsSection.jsx   # Threshold + auth + export
```

---

## 🔒 Security Architecture (MVP1)

| Layer | Implementation |
|-------|----------------|
| Authentication | Supabase Auth — Google OAuth + Email/Password + Magic Link |
| Authorization | RBAC via `user_profiles.role` — `manager` / `technician` / `pending` |
| Route Guards | `ProtectedRoute`, `ManagerRoute`, `GuestRoute` in React |
| New User Flow | Sign up → `pending` role → manager approves in Users section |
| RLS | All tables have RLS. Manager policies use `get_my_role()` SECURITY DEFINER fn to prevent recursion |
| Secrets | `.env` only, git-ignored. Vercel env vars for production |

---

## 🚀 MVP2 Backlog (Phase 4 — NOT YET STARTED)

> Do not start these until user gives explicit go-ahead.

1. **📊 Analytics Charts** — Usage by product/tech/time (Recharts)
2. **👤 Per-Technician Summary Cards** — Weekly/monthly usage stats
3. **💰 Blend Cost Calculator** — Realized cost per 100-gal application
4. **📍 Job/Location Tagging** — Attach logs to customer or job site
5. **☁️ PWA / Installable App** — Mobile home screen, offline fallback
6. **📧 Custom Email Branding** — Supabase custom SMTP for magic link emails

---

## 🔧 Maintenance Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-10 | Project initialized — B.L.A.S.T. Protocol 0 complete | System Pilot |
| 2026-03-10 | Discovery + planning complete — Schema confirmed | System Pilot |
| 2026-03-10 | Phase 2 (Link) complete — Supabase connected, 7 tables, 25 products, 3 blends seeded | System Pilot |
| 2026-03-10 | Phase 3 (Architect) complete — All 11 screens built and browser-verified | System Pilot |
| 2026-03-10 | Phase 4 (Stylize/Security) complete — Global auth, RBAC, Google OAuth, approval flow, new badge logo | System Pilot |
| 2026-03-10 | RLS recursion bug fixed — `get_my_role()` SECURITY DEFINER function added | System Pilot |
| 2026-03-10 | MVP1 signed off — all screens verified, GitHub pushed, Vercel deployment initiated | System Pilot |
