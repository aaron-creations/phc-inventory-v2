# SOP 01 — Database Schema

## Goal
Define and apply the Supabase schema for PHC Inventory v2.

## Tables
See `gemini.md` → Data Schema section for full column definitions.

## Migration Order
1. `products` (no foreign keys)
2. `blends` (no foreign keys)
3. `blend_components` (depends on products + blends)
4. `technicians` (no foreign keys)
5. `jobs` (no foreign keys)
6. `transactions` (depends on products, blends, technicians, jobs)
7. `settings` (no foreign keys)

## Seed Data Source
- Products: 25 products from `findings.md`
- Blends: 3 blends from `findings.md`
- Blend components: rates extracted from CSV mix_rate values
- Technician: Kevin R.
- Transactions: 9 records from CSV

## Stock Calculation Rule
> `containers_in_stock` is the single source of truth.
> It is a decimal. e.g., 4.65 containers of Tree-Age R10.
> USAGE/BLEND → decrement. RESTOCK → increment.
