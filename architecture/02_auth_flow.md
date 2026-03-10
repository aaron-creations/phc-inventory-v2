# SOP 02 — Authentication Flow

## Goal
Replace the insecure 4-digit client-side PIN with Supabase Auth.

## User Roles

### Technician (no login)
- Selects name from dashboard list
- Identity stored in localStorage for the session
- Can: log usage, view stock, view mix rates
- Cannot: access Manager panel

### Manager (Supabase Auth)
- Logs in with email + password
- Session persisted via Supabase session tokens
- Full access to all Manager panel sections

## Flow
1. Technician taps name → stored in localStorage → enters logging flow
2. Manager clicks Manager button → login form → Supabase Auth
3. Successful login → session token stored → Manager panel unlocked
4. Logout → session cleared → returned to main dashboard

## Edge Cases
- Session expires → redirect to login
- Wrong credentials → show error (do not reveal which field)
