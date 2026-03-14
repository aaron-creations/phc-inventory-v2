# SOP: App Architecture Overview

## Purpose
This document describes the technical architecture of PHC Inventory v2. It is the primary reference for understanding how the app is organized and how data flows between layers.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 |
| Styling | Tailwind CSS v3 |
| Routing | React Router v6 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email + password) |
| Charts | Recharts (Phase 4) |
| Dates | date-fns |
| Hosting | Vercel (Phase 5) |

---

## Route Map

| Path | Component | Who can access |
|------|-----------|----------------|
| `/` | `Dashboard` | Authenticated users |
| `/hub` | `HubPage` | Authenticated users |
| `/log` | `LoggingFlow` | Authenticated users |
| `/restock` | `RestockFlow` | Manager only |
| `/my-logs` | `MyLogsView` | Authenticated users |
| `/my-jobs` | `MyJobsView` | Authenticated users |
| `/stock` | `StockView` | Authenticated users |
| `/mix-rates` | `MixRatesView` | Authenticated users |
| `/fleet/*` | `FleetShell` | Manager only |
| `/manager/*` | `ManagerPanel` | Manager only |
| `/crm/*` | `CRMShell` | Manager only |
| `/admin/*` | `AdminShell` | Manager only |

---

## Data Flow

### Technician Logging (Single Product)
1. Tech selects their name on Dashboard → `/log/:techId`
2. Selects a product, enters amount
3. On submit:
   - INSERT into `transactions` (type = 'USAGE')
   - UPDATE `products.containers_in_stock` (decrement by calculated amount)

### Technician Logging (Blend)
1. Tech selects blend, enters gallons applied
2. On submit:
   - INSERT into `transactions` (type = 'BLEND', blend_id set)
   - For each blend_component: decrement corresponding product stock

### Manager Restock
1. Manager selects product + containers added
2. On submit:
   - INSERT into `transactions` (type = 'RESTOCK')
   - UPDATE `products.containers_in_stock` (increment)

---

## Stock Level Display

- **In Stock:** `containers_in_stock > low_stock_threshold`
- **Low Stock:** `0 < containers_in_stock <= low_stock_threshold`
- **Out of Stock:** `containers_in_stock <= 0`

---

## Unit Conversion Logic

### Direct-use products (unit_type = 'direct')
- Amount logged in mL
- Convert to containers: `mL / (container_size * container_unit_in_mL)`
- Note: The app uses the `containerSizeToMl` helper which maps specific `container_unit` to mL (e.g. gal, pint, qt, liter, oz).

### Mixed products (unit_type = 'mixed')
- Amount logged in gallons of mix applied
- Convert to containers: `gallons / container_size_gal`

### Blend components
- Rate is in `fl oz per 100 gal of mix`
- fl oz used = `(gallons_applied / 100) * rate_fl_oz_per_100_gal`
- Containers used = `fl_oz_used / (container_size_gal * 128)`

---

## Known Tech Debt

1. **Manager sidebar mobile** — no responsive layout; sidebar is desktop-only
   - Fix: Add hamburger menu / bottom nav for mobile manager view
2. **AdminShell coupling** — AdminShell directly imports components from Manager/sections.
   - Fix: Extract a shared Layout/Shell component if ManagerPanel undergoes major changes.
