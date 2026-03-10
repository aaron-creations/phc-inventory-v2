# SOP 04 — Stock Level Calculation

## Goal
Accurately calculate and display remaining stock per product.

## Source of Truth
`products.containers_in_stock` — decimal, updated on every USAGE/RESTOCK.

## Display
```
total_volume = containers_in_stock × container_size × unit_to_mL_factor
```

## Status Thresholds (configurable in Settings)
| Status | Condition |
|--------|----------|
| ✅ In Stock | containers_in_stock > low_stock_threshold |
| ⚠️ Low Stock | 0 < containers_in_stock ≤ low_stock_threshold |
| ❌ Out of Stock | containers_in_stock == 0 |

## Progress Bar Colors
- Green: In Stock
- Orange: Low Stock
- Red: Out of Stock

## Restock Logic
1. Insert RESTOCK into `transactions`
2. Increment `products.containers_in_stock` by `containers_added`
3. Record vendor and invoice_notes
