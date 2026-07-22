# Expense Splitter

A shared expense and deposit tracker for roommates, hostels, or any group pooling money together. Members deposit into a shared jar, log expenses against it, and everyone sees live, always-honest per-person balances.

> Built with TanStack Start (React) + Supabase, deployed on Netlify / Cloudflare Workers.

---

## ✨ Features

- **Group-based fund tracking** — create a group, invite roommates, and pool money into a shared jar.
- **Deposits & expenses** — admins log deposits; any member can log an expense with participant selection.
- **Live balances** — per-person balance is recalculated automatically as `balance = total deposited − total share of expenses`.
- **Role-aware UI** — group creators become admins automatically; members get a simpler view. Admin-only actions (edit/delete expenses, add/remove members, log deposits) are hidden from regular members.
- **Reports** — spending-over-time line chart and per-member totals bar chart (Recharts).
- **Admin group management** — clear the jar balance (wipes deposits/expenses, keeps members) or permanently delete a group (with a type-to-confirm safeguard).
- **Pre-added members** — admins can add members by email up front; those members skip onboarding when they sign up.
- **INR currency formatting** throughout the app.
- **Manual and equal expense splits** — split a bill evenly across participants or set custom amounts per person.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19) + [TanStack Router](https://tanstack.com/router) (file-based routing) |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix primitives) |
| Forms | react-hook-form + zod |
| Charts | Recharts |
| Data/Auth | Supabase (PostgreSQL, Auth, Row Level Security, RPCs) |
| State | React Context (`StoreProvider`) + TanStack Query |
| Toasts | Sonner |
| Build tool | Vite 8 |
| Deployment | Netlify (primary) / Cloudflare Workers via Wrangler |
| Language | TypeScript |

---

## 📂 Project Structure

```
expense/
├── src/
│   ├── routes/                  # File-based routes (TanStack Router)
│   │   ├── index.tsx            # Sign in
│   │   ├── onboarding.tsx       # Create a group
│   │   ├── dashboard.tsx        # Role-aware dashboard
│   │   ├── expenses.index.tsx   # Expense list
│   │   ├── expenses.new.tsx     # Add expense
│   │   ├── deposits.new.tsx     # Add deposit (admin only)
│   │   ├── members.tsx          # Manage group members
│   │   ├── reports.tsx          # Charts / reports
│   │   ├── profile.tsx          # Profile + admin danger zone
│   │   └── __root.tsx           # Root layout, providers, error boundaries
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   └── app-shell.tsx        # App shell / navigation
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client setup
│   │   ├── auth.tsx             # Auth context/provider
│   │   ├── store.tsx            # App state (groups, balances, mutations)
│   │   ├── api.ts                # Supabase RPC/query wrappers
│   │   └── utils.ts             # Helpers (e.g. currency formatting)
│   ├── hooks/
│   ├── router.tsx               # Router instance
│   ├── server.ts / start.ts     # TanStack Start server entry
│   └── styles.css               # Design tokens + Tailwind
├── supabase/
│   └── schema.sql               # Full DB schema, RLS policies, RPC functions
├── public/
├── .lovable/                    # Lovable build plan/config (original scaffold)
├── package.json
├── vite.config.ts
└── components.json              # shadcn/ui config
```

---

## 🗄️ Database Schema (Supabase / PostgreSQL)

Defined in `supabase/schema.sql`. Key tables:

| Table | Purpose |
|---|---|
| `profiles` | One row per authenticated user (name, email, avatar). |
| `groups` | A fund/jar — name, creator. |
| `group_members` | Join table linking users to groups, with `role` (`admin` / `member`) and running balance. |
| `deposits` | Money added to the jar, tied to a group and the member who deposited. |
| `expenses` | Money spent from the jar — title, amount, paid-by member. |
| `expense_participants` | Which members share an expense and their individual split amount. |

Key RPC functions (called from `src/lib/api.ts`):

- `create_group_with_members` — creates a group and adds initial members in one transaction.
- `add_group_member` — adds a member to an existing group.
- `create_expense` — creates an expense plus its participant splits atomically.
- `clear_jar_balance` — wipes all deposits/expenses for a group (members stay).
- `delete_group` — permanently deletes a group and all its data.
- `update_my_name` — lets a user update their own display name.
- `handle_new_user` — trigger that provisions a `profiles` row on signup.
- `is_group_member` / `is_group_admin` / `current_member_id` — RLS helper functions used across policies.

Row Level Security is enabled on all tables — members can only read/write data for groups they belong to, and admin-only actions are enforced at the database level, not just in the UI.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (or Bun — a `bunfig.toml` is present)
- A [Supabase](https://supabase.com) project

### 1. Clone & install

```bash
git clone https://github.com/Algode18/hostel-fund-manager.git
cd hostel-fund-manager/expense
npm install
```

### 2. Set up Supabase

1. Create a new Supabase project.
2. Run the contents of `supabase/schema.sql` in the Supabase SQL editor to create tables, RLS policies, and RPC functions.
3. Grab your project's **Project URL** and **anon/publishable key** from Supabase → Settings → API.

### 3. Environment variables

Create a `.env` file in the `expense/` directory:

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-or-publishable-key>
```

> ⚠️ These are `VITE_`-prefixed, which means they're baked into the client bundle at **build time**. Don't put secrets here — only the public anon/publishable key.

### 4. Run locally

```bash
npm run dev
```

The app will be available at `http://localhost:3000` (or the port Vite reports).

### 5. Build for production

```bash
npm run build
npm run preview   # preview the production build locally
```

---

## 📜 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Build in development mode |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier on the codebase |

---

## ☁️ Deployment

The app is currently deployed via **Netlify** (with a `.netlify/v1/functions/server.mjs` SSR function), and has also been deployed to **Cloudflare Workers** via **Wrangler** in earlier iterations.

**Netlify:**
1. Connect the GitHub repo in the Netlify dashboard.
2. Set the build command to `npm run build` and publish directory per TanStack Start's Netlify adapter output.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in Netlify's site settings (Site configuration → Environment variables).

**Cloudflare Workers (alternative):**
1. Configure `wrangler.json`/`wrangler.toml` with your Worker name and account details.
2. `npx wrangler deploy`
3. Set the same `VITE_*` env vars as Worker secrets/variables before building.

---

## 🔐 Authentication Notes

- Auth is handled via Supabase Auth (`src/lib/auth.tsx`, `src/lib/supabase.ts`).
- Local session storage key: `hostel-fund-auth` (legacy name — safe to rename, but doing so will log out existing sessions).
- Group creators are automatically assigned the `admin` role.
- Members added by an admin ahead of time (by email) skip the onboarding flow when they first sign up — they land straight in their group.

---

## 🧭 Roadmap / Recent Work

- [x] INR currency formatting
- [x] Manual expense splits (in addition to equal splits)
- [x] Admin-only group management (clear jar balance, delete group)
- [ ] Rename all "Hostel Fund Manager" branding to "Expense Splitter" across routes, meta tags, and storage keys

---

## 📄 License

No license specified yet — add one (e.g. MIT) if this project will be shared or open-sourced.

---

## 📝 Project Summary

**One-line summary:**
> Full-stack web app for group expense tracking and shared fund management, built with React, TanStack Start, and Supabase; deployed on Netlify with role-based access control.

**Short description:**
Built a full-stack expense-splitting application that lets groups (roommates, hostels, teams) pool money into a shared jar, log deposits and expenses, and track live per-person balances. Implemented secure multi-tenant data access with PostgreSQL Row Level Security, role-based permissions (admin/member), and real-time balance calculations across group members.

**Highlights:**

- Designed and built a full-stack expense-management web app using **React 19, TanStack Start/Router, and TypeScript**, with **Supabase (PostgreSQL)** as the backend, deployed on **Netlify** and **Cloudflare Workers**.
- Architected a **multi-tenant database schema** with **Row Level Security (RLS) policies** and atomic **PostgreSQL RPC functions** (transactional group creation, expense creation with participant splits, jar balance clearing) to enforce data isolation and admin-only permissions at the database level, not just the UI.
- Implemented **role-based access control** where group creators are auto-assigned admin privileges, and built a member-invite flow that lets admins pre-add members by email who skip onboarding on signup.
- Built **equal and manual expense-splitting logic**, letting users divide a bill evenly or assign custom amounts per participant, with balances recalculated live as `balance = deposits − share of expenses`.
- Developed admin-only group management tools (clear jar balance, permanently delete group) with confirmation safeguards to prevent accidental destructive actions.
- Built a **reporting dashboard** using Recharts to visualize spending trends over time and per-member expense totals.
- Localized currency formatting (INR) and used **Tailwind CSS v4 + shadcn/ui (Radix primitives)** for a consistent, accessible design system across 9+ routes.
- Managed the full deployment pipeline — environment variable configuration, Netlify SSR functions, and Cloudflare Workers deployment via Wrangler.

**Tech stack:**
`React · TypeScript · TanStack Start/Router · Supabase · PostgreSQL · Row Level Security · Tailwind CSS · shadcn/ui · Recharts · Netlify · Cloudflare Workers`