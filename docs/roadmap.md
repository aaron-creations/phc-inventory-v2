# PHC Inventory v2 — Enhancement Roadmap
> **Prepared:** March 23, 2026  
> **Audience:** Aaron + Kenneth  
> **Purpose:** Identify, prioritize, and scope the most impactful improvements to make the app shine — from both the field tech and business-owner perspectives.
>
> **Comments incorporated:** Reviewed with Aaron on March 23, 2026. Comments and decisions from that session are reflected below.

---

## 🔍 Diagnostic: What's Lacking Today

### Technician Dashboard (`/dashboard`)
- Shows **blend badges** — a nice reference, but passive (no actionable use)
- **Today's Route** is the only truly useful widget — this is the right idea, underdeveloped
- The 5-button nav grid is fine but lacks hierarchy — everything feels equal priority
- No job-time context (what time is the job? How long do I have?)
- No quick "how much product do I need?" tool — Kenneth specifically called this out
- No feedback when a job is finished — anticlimactic for a field worker

### Manager Dashboard (`/manager/dashboard`)
- KPI cards show **Total Products, Active Blends, Inventory Value, Usage Cost** — these are static counts that don't change daily; they're not *actionable*
- **Inventory Value** and **Usage Cost** are directionally interesting but shown without comparison (vs. last week? vs. budget?)
- Recent Activity is a raw transaction feed — 20 rows of data with no filtering, no signal, just noise
- No at-a-glance answer to: *"What needs my attention right now?"*

### Analytics Section (`/manager/analytics`)
- Has 7+ charts on one page — data overload with no narrative thread
- Charts exist but aren't connected to decisions
- "Burn Rate Predictor" is the most actionable thing on the page — buried at the bottom
- Technician donut → product bar drill-down is clever but visually lost
- Nothing about revenue, customer trends, or job profitability

---

## 🏆 What "Great" Looks Like

| Role | Core Need | Success Metric |
|------|-----------|---------------|
| **Technician** | Open app → know exactly what to do today → log it → done | < 3 taps from open to logged |
| **Manager (Kenneth)** | Open app → know what needs attention → act on it | Dashboard answers "what's on fire?" in < 5 seconds |

---

## 🚀 Phase 1 — Quick Wins (Frontend only, no DB schema changes)

### 1A. Manager Dashboard — Actionable KPI Redesign ✅ DONE
Replaced 4 static KPIs with situation-aware signals. Added "Needs Attention" section at top. Trimmed Recent Activity to 5 rows.

### 1B. Analytics — Consolidate to 3 Signal Charts ✅ DONE
**Keep:** Burn Rate Predictor (promoted to top), Cost Trend, Top Products by Usage.  
**Archived:** Day-of-week heatmap, Service type breakdown, Daily Activity volume, Restock vs Usage Balance, Technician donut.  
**Added:** Per-tech summary table, plain-English restock recommendation sentences.

### 1C. Technician Dashboard Overhaul ✅ DONE
Promoted Today's Route to hero. Added "No jobs today" state. Removed blend badges (move to Mix Rates). Tightened nav rail. Added job completion toast.

### 1D. Product Calculator on Mix Rates ✅ DONE
Added Calculator tab to Mix Rates. Built blend-formula-based calculator (area → fl oz product + water). Scaffolded non-blend products with "Coming Soon" pending SDS data from Kenneth.

### 1E. Restock to Stock View — Manager Only ✅ DONE
Moved restock logging into the Stock Levels view. Managers only. Pre-fill product when clicked from a product row or header button.

---

## 🔧 Phase 2 — Mid-Term Enhancements

### 2A. Job Time Slots on Technician View
Wire `start_time` / `end_time` into Today's Route cards. Mini timeline. Color-code by time proximity.

### 2B. Per-Technician Performance Cards (Manager View)
Team section card per tech: jobs this week, products logged, last active.

### 2C. Vendor Autocomplete + Invoice Photo Upload on Restock
Remember past vendors. Optional invoice image via Supabase Storage.

### 2D. Smart In-App Notifications
Notification bell. Triggers: low stock breach, job stuck in_progress >8h, pending user approvals. Use Supabase Realtime.

### 2E. PWA / Mobile Install Support ✅ agreed
`manifest.json` + Vite PWA plugin. Installable to home screen. Cache Mix Rates for offline reference.

---

## 🔮 Phase 3 — Strategic Features (Requires scoping with Kenneth)

### 3A. SingleOps Integration
**Action needed:** Kenneth confirms API access or CSV export capability.

### 3B. Customer Automated Messaging
New lead created → auto text/email to customer within 5 min.  
Stack: Supabase Edge Function + Twilio (SMS) or Resend (email).

### 3C. Job Resource Allocation & Forecasting
**Action needed:** Kenneth defines rules and formulas.

### 3D. Revenue & Profitability Tracking
Add billing field to jobs. Calculate gross margin per job.

---

## 📋 Prioritization Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Manager Dashboard redesign | 🔴 High | 🟢 Low | **#1 ✅** |
| Analytics consolidation | 🔴 High | 🟢 Low | **#2 ✅** |
| Tech Dashboard overhaul | 🟠 Med-High | 🟢 Low | **#3 ✅** |
| Product Calculator | 🔴 High | 🟢 Low | **#4 ✅** |
| Restock to Stock view | 🟠 Medium | 🟢 Low | **#5 ✅** |
| Job time slots on tech view | 🟠 Medium | 🟡 Med | **#6** |
| PWA / Mobile install | 🟠 Medium | 🟡 Med | **#7** |
| Smart in-app notifications | 🟠 Medium | 🟡 Med | **#8** |
| Per-tech performance cards | 🟡 Low-Med | 🟡 Med | **#9** |
| SingleOps integration | 🔴 High | 🔴 High | **#10 (after API access)** |
| Automated customer messaging | 🔴 High | 🔴 High | **#11 (needs Twilio/Resend)** |
| Job resource allocation | 🔴 High | 🔴 High | **#12 (needs Kenneth's math)** |
| Job profitability tracking | 🟠 Medium | 🟡 Med | **#13** |

---

## ❓ Open Questions for Kenneth

1. **Product Calculator:** Send your SDS sheets or existing Google Sheets calculator — we need the formulas for non-blend direct products.
2. **SingleOps:** What plan are you on? Is API access available? Can you export a CSV of jobs/customers?
3. **Job Resource Allocation:** Which equipment is required per job type? Does it vary or is it consistent by service?
4. **Notifications:** In-app alerts sufficient, or do you also want SMS/email notifications?
5. **Revenue tracking:** Do you charge per job, or subscription/contract? This shapes how profitability tracking works.

---

## 📁 Related Files
- `docs/phase1-plan.md` — Detailed implementation plan for Phase 1
- `docs/phase2-plan.md` — Detailed implementation plan for Phase 2
- `docs/phase3-plan.md` — Detailed implementation plan for Phase 3
