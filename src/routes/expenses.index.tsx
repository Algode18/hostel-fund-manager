import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { formatDate, formatINR, useCurrentGroup, useCurrentMember, useStore } from "@/lib/store";
import { apiErrorMessage } from "@/lib/api";

export const Route = createFileRoute("/expenses/")({
  head: () => ({
    meta: [
      { title: "Expenses — Expense Splitter" },
      { name: "description", content: "All shared expenses with filters." },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const group = useCurrentGroup();
  const me = useCurrentMember();
  const store = useStore();
  const [query, setQuery] = useState("");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const editTitle = async (id: string, currentTitle: string) => {
    const t = prompt("New title", currentTitle);
    if (!t || !t.trim()) return;
    setBusyId(id);
    try {
      await store.updateExpense(id, { title: t.trim() });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    setBusyId(id);
    try {
      await store.deleteExpense(id);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const rows = useMemo(() => {
    return store.expenses
      .filter((e) => e.groupId === group.id)
      .filter((e) => memberFilter === "all" || e.paidBy === memberFilter)
      .filter((e) => e.title.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [store.expenses, group.id, memberFilter, query]);

  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-4xl">Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every receipt, split fairly. {rows.length} shown.
          </p>
        </div>
        {me.role === "admin" && (
          <Link
            to="/expenses/new"
            className="inline-flex items-center gap-2 self-start rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground shadow-sm hover:bg-brand/90"
          >
            <Plus className="size-4" /> Add expense
          </Link>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-surface p-3 ring-1 ring-black/5 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title…"
            className="w-full rounded-lg bg-background py-2 pl-9 pr-3 text-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="all">All payers</option>
          {group.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Paid by</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Split</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              {me.role === "admin" && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-950/5">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={me.role === "admin" ? 6 : 5}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No expenses match.
                </td>
              </tr>
            )}
            {rows.map((e) => {
              const payer = group.members.find((m) => m.id === e.paidBy);
              return (
                <tr key={e.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3 font-medium">{e.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{payer?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(e.createdAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.participantIds.length} people
                    {e.splitType === "manual" && (
                      <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand">
                        manual
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatINR(e.amount)}</td>
                  {me.role === "admin" && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-50"
                          title="Edit"
                          disabled={busyId === e.id}
                          onClick={() => editTitle(e.id, e.title)}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-brand/10 hover:text-brand disabled:opacity-50"
                          title="Delete"
                          disabled={busyId === e.id}
                          onClick={() => remove(e.id, e.title)}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}