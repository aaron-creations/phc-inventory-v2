# SOP 03 — Technician Logging Flow

## Goal
Allow a technician to log chemical usage with automatic stock decrement.

## Inputs
- Technician ID (from localStorage)
- Date (defaults to today)
- Mode: `blend` or `single`
- Blend mode: `blend_id` + `gallons_of_mix`
- Single mode: `product_id` + `amount` + `unit`
- Optional: `job_id` (Phase 4 enhancement)

## Logic

### Single Product
1. Select product from dropdown
2. Read `unit_type` (direct vs mixed)
3. Direct → show mL input. Mixed → show gallons-of-mix + display mix rate inline
4. On submit: calculate volume used
5. Insert USAGE record into `transactions`
6. Decrement `products.containers_in_stock`

### Blend
1. Select blend
2. Fetch `blend_components` for that blend
3. Show recipe summary (all components + rates)
4. User enters `gallons_of_mix`
5. For each component: volume = (gallons × rate_fl_oz) / container_size_fl_oz
6. Insert BLEND record into `transactions`
7. Decrement each component's `containers_in_stock`

## Edge Cases
- Stock would go negative → show warning, allow override
- Product out of stock → show badge in dropdown, still allow logging
- Multiple logs → `+ Add Another` appends row before submit
