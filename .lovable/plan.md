# Hostel Fund Manager — UI-Only Build Plan

Build the full spec as a UI prototype using mock data. No Supabase, no auth wiring — all backend integration happens later outside Lovable.

## Scope

- All 9 pages listed in the spec
- Multi-group support (group switcher in header)
- Role-aware UI (admin vs member) driven by a mock current-user toggle so the user can preview both roles
- Mock data lives in a single `src/lib/mock-data.ts` module; a tiny in-memory store hook lets forms feel functional (add/edit/delete update local state) without persistence

## Design Direction

Warm, focused finance-tracker aesthetic — not generic SaaS purple. Clear numeric hierarchy for balances, dense-but-readable lists for expenses, restrained motion. I'll generate 3 design directions and let you pick before building.

## Routes (TanStack Router)

```
/                       → Login (Google button, non-functional)
/onboarding             → Create Group (admin first-time)
/dashboard              → Role-aware dashboard
/expenses               → Expenses list (filters; edit/delete admin-only)
/expenses/new           → Add Expense (participant checkboxes)
/deposits/new           → Add Deposit (admin-only)
/members                → Group Members (admin add/remove)
/reports                → Charts: spending over time, per-member totals
/profile                → Profile / Settings
```

Header has a group switcher and a dev-only role toggle (Admin ↔ Member) so both views are demoable.

## Pages

1. **Login** — centered card, app logo, "Continue with Google" button (no-op → navigates to /dashboard)
2. **Onboarding / Create Group** — group name + dynamic list of initial members (name + email rows)
3. **Dashboard**
   - Member view: Your Balance, Total Deposited, Total Spent, recent expenses
   - Admin view: Pool total, Today's Expense, Members count, recent activity
4. **Add Expense** — title, amount, paid-by select, participant checkboxes with live per-person share preview (`amount / participants`)
5. **Add Deposit** (admin) — member select, amount
6. **Members** — table with name/email/role/balance; admin sees add + remove actions
7. **Expenses List** — filters (member, date range, search); admin sees edit/delete row actions
8. **Reports** — line chart (spending over time) + bar chart (per-member totals) using Recharts
9. **Profile / Settings** — name, email, avatar, sign-out (no-op)

## Data Model (mock only)

`src/lib/mock-data.ts` exports typed seed data matching the spec schema (groups, group_members, deposits, expenses, expense_members). `src/lib/store.ts` wraps it in a small React context so add/edit/delete mutations update in-memory state and recompute balances on the client. All IDs are UUIDs generated client-side.

Balance recompute: `balance = sum(deposits) − sum(expense_members.share)`.

## Technical Details

- TanStack Start file-based routes under `src/routes/`
- shadcn/ui components (Card, Table, Dialog, Form, Select, Checkbox, Tabs)
- Recharts for reports
- lucide-react icons (domain-specific, not Sparkles)
- Semantic color tokens in `src/styles.css` — no hardcoded colors in components
- Head metadata per route (title/description/og)
- The placeholder `/` index gets replaced by Login
- No Lovable Cloud, no Supabase client, no auth libs installed

## Flow

1. Generate 3 design directions → you pick one
2. Build design system tokens + shared layout (header with group switcher + role toggle)
3. Build all 9 routes with mock store wired to forms
4. Verify build passes and role toggle correctly shows/hides admin actions
