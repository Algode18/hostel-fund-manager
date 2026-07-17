import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { formatINR, useCurrentGroup, useStore } from "@/lib/store";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Hostel Fund Manager" },
      { name: "description", content: "Spending trends and per-member totals." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const group = useCurrentGroup();
  const { expenses } = useStore();
  const groupExpenses = expenses.filter((e) => e.groupId === group.id);

  const daily = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of groupExpenses) {
      const day = e.createdAt.slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + e.amount);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, amount]) => ({
        day: new Date(day).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        amount: Math.round(amount),
      }));
  }, [groupExpenses]);

  const perMember = useMemo(() => {
    return group.members.map((m) => {
      const total = groupExpenses
        .filter((e) => e.participantIds.includes(m.id))
        .reduce((s, e) => s + e.amount / e.participantIds.length, 0);
      return { name: m.name.split(" ")[0], total: Math.round(total), hue: m.avatarHue };
    });
  }, [group.members, groupExpenses]);

  const totalSpent = groupExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatINR(totalSpent)} spent across {groupExpenses.length} receipts in {group.name}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl bg-card p-6 ring-1 ring-black/5 lg:col-span-3">
          <h2 className="mb-4 text-sm font-medium">Spending over time</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatINR(v)}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="var(--color-brand)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "var(--color-brand)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-6 ring-1 ring-black/5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-medium">Per-member share</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perMember} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatINR(v)}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {perMember.map((p, i) => (
                    <Cell key={i} fill={`hsl(${p.hue} 55% 55%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
