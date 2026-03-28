# PHC Inventory v2 — Handoff Guide

**Prepared by:** Aaron Munro  
**Prepared for:** Kenneth Saer  
**Date:** March 2026  

---

## Overview

This document is your step-by-step guide to owning and running your own instance of the PHC Inventory v2 application. By the end of this guide, you will have:

- Your own GitHub repository with the source code
- Your own Supabase project (database, auth, and API keys)
- Your own Vercel deployment with a public URL

---

## What You'll Need

| Account | Purpose | URL |
|---|---|---|
| GitHub | Source code hosting | https://github.com |
| Supabase | Database & Authentication | https://supabase.com |
| Vercel | App hosting (free tier) | https://vercel.com |
| Claude Pro | AI coding assistant | https://claude.ai |

> If you don't already have accounts on these platforms, sign up for free before proceeding.

---

## Step 1: Fork the GitHub Repository

1. Go to: **https://github.com/aaron-creations/phc-inventory-v2**
2. Click the **Fork** button in the top-right corner
3. Choose your own GitHub account as the destination
4. Click **Create Fork**

You now own a copy of the code in your GitHub account that you can modify freely.

---

## Step 2: Create a New Supabase Project

> Warning: This creates your own private database. All production data will live here.

1. Go to **https://supabase.com** > Sign In > **New Project**
2. Choose your organization, give the project a name (e.g., `phc-inventory`), and set a strong database password (save it!)
3. Select **US East** as the region (closest to Colorado)
4. Click **Create new project** and wait ~2 minutes for it to initialize

### 2a. Run the Database Schema

Once your project is ready:

1. In your Supabase dashboard, click **SQL Editor** (left sidebar)
2. Ask Claude Code to generate the full schema SQL from the existing project, or contact Aaron
3. Paste and run the SQL to create all 7 tables: `products`, `blends`, `blend_components`, `technicians`, `transactions`, `settings`, `user_profiles`

### 2b. Grab Your API Credentials

1. Go to **Project Settings > API** (left sidebar)
2. Copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key (the long JWT string)

---

## Step 3: Configure Your Environment Variables

1. In your forked GitHub repo, look for the file `.env.example`
2. Create a new file called `.env` (do NOT commit this — it's already in `.gitignore`)
3. Fill it in:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Step 4: Deploy to Vercel

1. Go to **https://vercel.com** > **Add New Project**
2. Import your forked GitHub repository
3. Vercel will auto-detect it as a **Vite** project
4. Before deploying, go to **Environment Variables** and add:
   - `VITE_SUPABASE_URL` -> your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` -> your Supabase anon key
5. Click **Deploy**

After ~1 minute your app will be live at a URL like: `https://phc-inventory-yourname.vercel.app`

> Every time you push code to your `main` branch on GitHub, Vercel automatically re-deploys.

---

## Step 5: Set Up Authentication

### Create Your Manager Account

1. In your Supabase dashboard > **Authentication > Users > Invite User**
2. Enter your email address
3. You'll receive a magic link — click it to complete sign-up
4. Your account will default to `pending` role

### Promote Yourself to Manager

1. In Supabase > **Table Editor > user_profiles**
2. Find your row and change the `role` column from `pending` to `manager`
3. Save the row

### Enable Google OAuth (Optional but Recommended)

1. Supabase > **Authentication > Providers > Google**
2. Follow the on-screen instructions to connect a Google Cloud Console app
3. Add your Vercel domain to the allowed redirect URLs

---

## Step 6: Seed Your Inventory Data

Before going live, you'll want accurate stock levels in the app.

**Option A: Import CSV**
1. Log into the app as Manager
2. Go to **Manager View > Inventory**
3. Click **Import CSV** and upload a CSV file with product names and container counts
4. Review the preview and click Import

**Option B: Manual Entry**
- Use the **Add Product** button in Manager > Inventory to add products one by one

**Option C: Export > Edit > Import**
1. If Aaron's test data is close, export the current CSV from the existing app
2. Edit the `Containers` column values in Excel/Sheets
3. Import the modified file into your new instance

---

## Step 7: Add Your Team

1. Have each technician sign up at your app URL (via Google or email)
2. Their accounts will start as `pending`
3. You (manager) go to **Admin > Users** and approve them, setting their role to `technician`
4. Then go to **Admin > Team** to create their technician profile and link it to their account

---

## Day-to-Day Operations Quick Reference

| Task | Who | Where |
|---|---|---|
| Log product usage | Technician | Field Ops > Log Usage |
| View stock levels | Anyone | Field Ops > Stock Levels |
| Check mix rates & calculators | Technician | Field Ops > Mix Rates |
| Log a restock | Manager | Stock Levels > + Restock |
| View analytics & usage history | Manager | Manager View |
| Add/edit products | Manager | Manager View > Inventory |
| Edit blend formulas | Manager | Manager View > Blends |
| Approve new users | Manager | Admin > Users |
| Add technician profiles | Manager | Admin > Team |

---

## Mix Rate Calculator Quick Reference

The app has built-in calculators under **Field Ops > Mix Rates > Calculator tab**:

| Calculator | What it Does |
|---|---|
| Blend Mix | Enter tank gallons, get per-ingredient fl oz for any blend recipe |
| Spray Mix | Pick any mixed product, enter spray volume, get product + water amounts |
| Shortstop/Cambistat | Enter DBH -> get mL of product (DBH^2 / 12) and water |
| PhosphoJet | Enter DBH -> get injection sites, total volume, product:water ratio |
| Mn-Jet | Enter DBH + Spring/Fall -> get injection sites and total mL |

---

## Troubleshooting

**Q: A technician can't log in**  
A: Check Admin > Users — their account may still be `pending` approval.

**Q: Stock levels look wrong after a log**  
A: Verify the product's `container_size` and `container_unit` are correct in Manager > Inventory. These fields drive the stock math.

**Q: The blend mix rate isn't saving**  
A: This was a known bug that has been fixed. If it persists, check that both `product_id` and `rate_fl_oz_per_100_gal` are populated before clicking Add.

**Q: I want to reset all inventory for a fresh start**  
A: Export the current CSV, zero out the Containers column in Excel, then re-import it via Import CSV.

**Q: I want to bring back CRM or Fleet features**  
A: Contact Aaron. The code is preserved — it just needs to be re-enabled in `App.jsx` and `HubPage.jsx`.

---

## Getting Help with AI (Claude)

You already have Claude Pro. Here's how to get the most out of it for this app:

1. **Download Claude Desktop** (not just the web version) — it's more powerful
2. Open your forked GitHub repo in a code editor (VS Code works great)
3. When you want to make a change, describe what you want in plain English to Claude Code
4. Claude will read the code, make the changes, and explain what it did
5. Push the changes to GitHub -> Vercel automatically deploys

**Example prompts you could use:**
- "Add a notes field to the product log form"
- "Show me the top 3 most-used products this month on the Manager Dashboard"
- "Fix the spelling of [product name] in the database"

---

## Architecture Summary

```
Your GitHub Repo (code)
    v auto-deploy on push
Vercel (hosting -- app runs here)
    v API calls
Supabase (database + authentication)
```

All three tiers are free on their starter plans. The only cost may come if you exceed Supabase's free tier limits (500MB database, 50,000 monthly active users — you won't hit these for a long time).

---

*Questions? Reach out to Aaron — happy to help as you grow this into the full platform you envisioned.*
