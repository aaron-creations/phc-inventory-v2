# 📦 PHC Inventory v2 — Enhancement Scope
# Written after Phase 3 completion. DO NOT START until user gives go-ahead.

## Priority Order (as agreed with user)

### 1. 📊 Analytics Dashboard
- New route: `/manager/analytics`
- Charts using Recharts:
  - Usage over time (line chart by product or blend)
  - Cost breakdown by product (bar chart)
  - Per-technician usage summary
- Date range picker (last 7 / 30 / 90 days)
- Data source: `transactions` table JOIN `products` / `blends` / `technicians`

### 2. 🔔 Low-Stock Alert Banners
- Show on Dashboard AND Manager Dashboard when any product stock ≤ threshold
- Alert banner: "X products are running low — view Stock"
- Configurable threshold already in `settings` table
- Sort low/out-of-stock items to top of Stock Levels view

### 3. 👤 Per-Technician Summary Cards
- Show in Team section of Manager Panel
- Weekly / Monthly toggles
- Cards showing: products logged, total gallons applied, top product used

### 4. 💰 Blend Cost Calculator
- In Mix Rates view (or a new tab)
- Input: gallons of mix to be applied
- Output: itemized cost per component + total realized cost
- Data source: `blend_components` + `products.cost_per_container`

### 5. 📍 Job/Location Tagging
- `jobs` table already exists in schema
- Add job selector to Logging Flow
- Show job name in transaction history
- Optional: group transactions by job

### 6. ☁️ PWA / Installable App
- Add `vite-plugin-pwa` to Vite config
- Create `manifest.webmanifest` with app name, icons, theme color
- Service worker for offline fallback page
- Test install to iPhone home screen

---

## 🚀 Future "PHC OS" Architecture (Phase 5+)
*Note: These represent a major architectural shift from a single inventory app to a multi-app business operating system.*

### 7. 📱 The "App Launcher" Experience
- **Concept:** Post-login, users land on a "Suite" launcher (like Google Workspace or Microsoft 365) instead of directly into inventory.
- **UI:** Large, touch-friendly tiles: [Inventory & Logs], [CRM & Routing], [Fleet & Equipment].
- **RBAC:** Show/hide apps based on user role.

### 8. 🌐 Universal Platform Features (The "Core")
- **Concept:** Break out global functionality from individual apps so they govern the entire OS.
- **User Management & RBAC:** Centralized user roles (e.g., Tech vs. Manager vs. Mechanic) controlling launcher access.
- **Global Settings:** Shared configurations like company details or Twilio API keys.
- **Billing / Subscriptions (Future):** Support if rolled out to other branching franchises.

### 9. 🤝 Comprehensive PHC CRM & Lead Management
- **Concept:** A fully functional CRM designed specifically for Plant Health Care operations, housing all customer data, scheduling, and service history.
- **Lead Capture (The Bridge):**
  1. Corporate website form sends "New Lead" email to branch inbox.
  2. Inbox auto-forwards to Zapier/SendGrid Parser.
  3. Parser extracts Name/Phone/Address, sends Webhook to Supabase, and creates a "Lead" record.
  4. App triggers Twilio auto-reply SMS.
- **Customer Profiles (Data Model):**
  - **Core Info:** Name, Phone (Mobile/Home/Office), Email, Lead Source, Status (Lead, Active, Past).
  - **Properties/Locations:** A customer can have multiple properties (Billing Address vs. Service Address).
  - **Service History:** Full log of every visit, product applied, and technician notes linked to the property.
  - **Estimates & Billing:** Fields for quoted price, invoice status, and billing notes (Note: Do not build full QuickBooks syncing yet, just track the financial state in the CRM).
  - **Schedules/Programs:** Track recurring service schedules (e.g., "Spring Fert", "Fall Dormant Oil", "Monthly Mosquito Tick").
- **Workflow:** Lead approved -> Becomes "Active Customer" -> Jobs generated from schedules -> Tech logs inventory against the Job -> Job marked complete -> Triggers Review SMS.

### 10. ⭐ Automated Review Harvester
- **Concept:** Auto-SMS customers via Twilio when a job is marked "Done."
- **Data Source:** Triggered by job completion status in the CRM module.
- **Reward:** High ROI for local SEO without extra manual work.

### 11. 🚜 Equipment & Maintenance Tracker
- **Concept:** Preventative maintenance alerts for trucks, sprayers, and chippers.
- **Features:** Track engine hours/dates and auto-alert mechanics when service is due.
- **Location:** A standalone "app" accessible from the new Launcher screen.

---

## 💡 Niche Enhancements
*Specialized use-cases discussed for future consideration.*

### 12. 🆔 Custom User IDs / Employee PINs
- **Scenario A: Employee ID (Payroll/HR Sync)**
  - **Concept:** Assign an ID like `EMP-1042` to each technician.
  - **Purpose:** Makes exporting and syncing transactions to Gusto, QuickBooks, or other payroll platforms much easier than matching by "First Name + Last Initial".
  - **Implementation:** Add an `employee_id` field to the `technicians` table and include it in CSV exports.
- **Scenario B: 4-Digit PIN (Kiosk Login Mode)**
  - **Concept:** A shared "Kiosk Mode" for tablets/phones where a tech just taps a 4-digit PIN to log their usage.
  - **Purpose:** Massive speed improvement for technicians in the field, eliminating the need to remember passwords or wait for Magic Links.
  - **Implementation:** Requires a custom security layer on top of Supabase Auth to handle token management via PINs instead of strict email session tokens.
