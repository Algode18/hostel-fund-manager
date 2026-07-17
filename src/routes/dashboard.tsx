import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, TrendingUp, Users, Wallet, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  computeBalances,
  formatDate,
  formatINR,
  useCurrentGroup,
  useCurrentMember,
  useStore,
} from "@/lib/store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Hostel Fund Manager" },
      { name: "description", content: "Your balance, deposits, and shared expenses at a glance." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const group = useCurrentGroup();
  const me = useCurrentMember();
  const { deposits, expenses, groups, loading } = useStore();

  // Still fetching the user's groups — show nothing (avoids a flash of the
  // empty state) rather than redirecting anywhere.
  if (loading) return null;

  // Genuinely no groups yet — this is a normal, valid state for a new user.
  // Let them choose to create one instead of force-redirecting them away.
  if (groups.length === 0) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
            <div className="size-5 rounded-full border-2 border-current" />
          </div>
          <h1 className="font-display text-3xl">No jar yet</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            You're not part of a group yet. Start a new jar whenever you're ready — it's totally up
            to you.
          </p>
          <a
            href="/onboarding"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-medium text-brand-foreground shadow-sm transition-transform hover:bg-brand/90 active:scale-[0.98]"
          >
            <Plus className="size-4" /> Start a new jar
          </a>
        </div>
      </AppShell>
    );
  }

  if (!group || !me) return null;

  const balances = computeBalances(group, deposits, expenses);
  const mine = balances[me.id] ?? { deposited: 0, spent: 0, balance: 0 };

  const groupExpenses = expenses.filter((e) => e.groupId === group.id);
  const groupDeposits = deposits.filter((d) => d.groupId === group.id);
  const pool =
    groupDeposits.reduce((s, d) => s + d.amount, 0) -
    groupExpenses.reduce((s, e) => s + e.amount, 0);
  const todayISO = new Date().toISOString().slice(0, 10);
  const todaySpent = groupExpenses
    .filter((e) => e.createdAt.slice(0, 10) === todayISO)
    .reduce((s, e) => s + e.amount, 0);

  const recent = [...groupExpenses]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <AppShell>
      <section className="mb-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {me.role === "admin" ? "Current Jar Balance" : "Your Balance"}
            </p>
            <h1 className="font-display text-6xl leading-none text-brand">
              {formatINR(me.role === "admin" ? pool : mine.balance)}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Welcome back, {me.name.split(" ")[0]}. {group.members.length} members in {group.name}.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/expenses/new"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground shadow-sm transition-transform hover:bg-brand/90 active:scale-[0.98]"
            >
              <Plus className="size-4" /> Add expense
            </Link>
            {me.role === "admin" && (
              <Link
                to="/deposits/new"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:bg-brand-soft/40"
              >
                <Wallet className="size-4" /> Log deposit
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        {me.role === "admin" ? (
          <>
            <Stat label="Pool total" value={formatINR(pool)} accent />
            <Stat label="Today's expense" value={formatINR(todaySpent)} />
            <Stat
              label="Members"
              value={String(group.members.length)}
              icon={<Users className="size-4" />}
            />
          </>
        ) : (
          <>
            <Stat label="Your balance" value={formatINR(mine.balance)} accent />
            <Stat label="Total deposited" value={formatINR(mine.deposited)} />
            <Stat
              label="Total spent"
              value={formatINR(mine.spent)}
              icon={<TrendingUp className="size-4" />}
            />
          </>
        )}
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent activity</h2>
            <Link
              to="/expenses"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              View all <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-stone-950/5 rounded-2xl border border-border bg-card">
            {recent.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No expenses yet. Add the first one.
              </p>
            )}
            {recent.map((e) => {
              const payer = group.members.find((m) => m.id === e.paidBy);
              return (
                <div key={e.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="size-10 shrink-0 rounded-full ring-1 ring-black/5"
                      style={{ backgroundColor: `hsl(${payer?.avatarHue ?? 0} 45% 82%)` }}
                    />
                    <div>
                      <p className="font-medium">{e.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Paid by {payer?.name.split(" ")[0] ?? "?"} • {formatDate(e.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatINR(e.amount)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Split by {e.participantIds.length}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-surface p-6 ring-1 ring-black/5">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Member ledger
            </h3>
            <ul className="space-y-3">
              {group.members.map((m) => {
                const b = balances[m.id]?.balance ?? 0;
                const positive = b >= 0;
                return (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-6 rounded-full ring-1 ring-black/5"
                        style={{ backgroundColor: `hsl(${m.avatarHue} 45% 82%)` }}
                      />
                      <span className="text-foreground">{m.name.split(" ")[0]}</span>
                    </div>
                    <span
                      className={positive ? "font-medium text-positive" : "font-medium text-brand"}
                    >
                      {positive ? "+" : ""}
                      {formatINR(b)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={"rounded-2xl p-6 ring-1 ring-black/5 " + (accent ? "bg-brand/5" : "bg-surface")}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {icon}
      </div>
      <p className={"mt-2 text-3xl font-semibold " + (accent ? "text-brand" : "")}>{value}</p>
    </div>
  );
}