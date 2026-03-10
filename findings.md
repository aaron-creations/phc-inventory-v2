# PHC Inventory v2 — Findings & Research

## App Audit (Source: Live URL — March 9, 2026)
Full audit performed on `https://phc-inventory-n5ot-8kx7uk7nm-kensaers-projects.vercel.app/`
Manager panel accessed with PIN: 0419.

### Technology Stack (Inferred)
- **Frontend:** React SPA, Tailwind CSS dark theme
- **Database:** Likely Supabase or Firebase (real-time, cloud-hosted)
- **Auth:** 4-digit PIN — client-side only (security gap)
- **Deployment:** Vercel

### Key UI/UX Patterns
- Treatment mode toggle: `Blend` vs `Single Product`
- Dynamic unit switching per product type (mL for direct, gal mix for diluted)
- Color-coded stock progress bars (green/orange/red)
- Expandable BLEND transaction rows showing component breakdown
- Manager sidebar navigation with section-based routing
- KPI stat cards: Total Products (25), Active Blends (3), Inventory Value ($5,027.85), Usage Cost ($246.52)

### Security Finding
- 4-digit passcode validated client-side only — no server auth layer.
- **Resolution:** Supabase Auth with email + password for manager role.

---

## CSV Data (Source: PHC_Inventory.csv — March 10, 2026)

### Products — 25 Total

| Product | Containers | Container Size | Unit | Mix Rate | Cost/Container |
|---------|-----------|----------------|------|----------|----------------|
| ArborJet Tree-Age R10 Insecticide | 4.6549 | 1 pint | Direct | $465.20 |
| Shortstop 2SC Plant Growth Regulator | 1.25 | 1 gal | Direct | $397.58 |
| Spring Fert - ArborJet NUTRIROOT 2-2-3 | 0 | 1 gal | 64 fl oz/100 gal | $178.14 |
| Spring Fert - BioPro ArborPlex 14-4-5 | 0.90 | 2.5 gal | 64 fl oz/100 gal | $85.29 |
| Spring Fert - BioPro BioMP 5-3-2 | 3.86 | 2.5 gal | 15 fl oz/100 gal | $65.96 |
| Spring Fert - BioPro EnviroPlex Soil Conditioner | 3.89 | 2.5 gal | 12 fl oz/100 gal | $61.93 |
| Ecologel Hydretain Liquid Humectant | 0.71 | 2.5 gal | 28 fl oz/100 gal | $156.71 |
| Cytogro Hormone Biostimulant | 0.50 | 1 gal | 4 fl oz/100 gal | $39.70 |
| Tengard SFR Termiticide/Insecticide | 7.00 | 1.25 gal | 64 fl oz/100 gal | $70.56 |
| Eagle 20EW Liquid Fungicide | 0.25 | 1 pint | 6 fl oz/100 gal | $32.99 |
| Talstar P Professional Insecticide | 0.25 | 1 pint | 12 fl oz/100 gal | $36.64 |
| Avid 0.15 EC Insecticide | 0.10 | 8 oz | 4 fl oz/100 gal | $105.23 |
| Yardage Acidifier Penetrant Drift Control Agent | 1.25 | 2.5 gal | 3 fl oz/100 gal | $88.03 |
| Transfilm Anti-Transpirant | 0.9944 | 2.5 gal | 3 fl oz/1 gal | $212.18 |
| Yuccah Natural Wetting Agent | 0.50 | 2.5 gal | Direct | N/A |
| PhosphoJet Systemic Fungicide | 0.50 | 1 liter | Direct | $72.14 |
| MnJet | 1.50 | 1 liter | Direct | $100.29 |
| Naturcide | 0.10 | 64 oz | Direct | $153.95 |
| Propiconazole | 0.25 | 1 qt | Direct | $65.44 |
| ArborPro 15-8-4 | 0.10 | 2.5 gal | 64 fl oz/100 gal | $94.50 |
| Zylam | 1.00 | 1 qt | Direct | N/A |
| Fall Fert - ArborJet Nutriroot 2-2-3 | 0.50 | 2.5 gal | 64 fl oz/100 gal | $178.14 |
| Fall Fert - BioPro ArborPlex 14-4-5 | 2.50 | 2.5 gal | 16 fl oz/100 gal | $85.29 |
| Fall Fert - BioPro BioMP 5-3-2 | 2.50 | 2.5 gal | 15 fl oz/100 gal | $65.96 |
| Fall Fert - BioPro EnviroPlex | 2.00 | 2.5 gal | 6 fl oz/100 gal | $61.93 |

### Blends — 3 Total

| Blend | Components |
|-------|------------|
| Spring Fertilizer Blend | NUTRIROOT 2-2-3, ArborPlex 14-4-5, BioMP 5-3-2, EnviroPlex Soil Conditioner |
| Fall Fertilizer Blend | Nutriroot 2-2-3, ArborPlex 14-4-5, BioMP 5-3-2, BioPro EnviroPlex |
| Mountain Pine Beetle | Tengard SFR, Yardage Acidifier |

### Transactions — 9 Total

| Date | Type | Product/Blend | Tech | Input | Cost |
|------|------|---------------|------|-------|------|
| 2026-02-26 | USAGE | Transfilm Anti-Transpirant | Kevin R. | 60 gal mix | $1.19 |
| 2026-02-26 | USAGE | Ecologel Hydretain | Kevin R. | 320 gal mix | $43.88 |
| 2026-02-25 | USAGE | Ecologel Hydretain | Kevin R. | 100 gal mix | $0.72 |
| 2026-02-25 | RESTOCK | ArborJet Tree-Age R10 | — | +2 containers | $930.40 |
| 2026-02-25 | BLEND | Spring Fertilizer Blend | Kevin R. | 100 gal mix | $22.47 |
| 2026-02-25 | USAGE | ArborJet Tree-Age R10 | Kevin R. | 20 mL | $19.66 |
| 2026-02-23 | BLEND | Spring Fertilizer Blend | Kevin R. | 100 gal mix | $22.47 |
| 2026-02-23 | BLEND | Spring Fertilizer Blend | Kevin R. | 100 gal mix | $111.54 |
| 2026-02-23 | USAGE | ArborJet Tree-Age R10 | Kevin R. | 25 mL | $24.58 |

### Inventory Totals
- **Total Inventory Value:** $5,027.85
- **Total Usage Cost (on record):** $246.52

---

## Libraries Selected
- **Recharts** — Charts for Analytics Dashboard
- **@supabase/supabase-js** — Supabase client
- **react-router-dom v6** — Client-side routing
- **date-fns** — Date formatting utilities
