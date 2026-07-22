import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { UserPlus, Trash2, ChevronDown, Receipt } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import {
  computeBalances,
  formatDate,
  formatINR,
  useCurrentGroup,
  useCurrentMember,
  useStore,
} from "@/lib/store";
import { apiErrorMessage } from "@/lib/api";

export const Route = createFileRoute("/members")({
  head: () => ({
    meta: [
      { title: "Members — Expense Splitter" },
      { name: "description", content: "The roommates in your fund." },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const group = useCurrentGroup();
  const me = useCurrentMember();
  const store = useStore();
  const balances = computeBalances(group, store.deposits, store.expenses);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const canManage = me.role === "admin";

  // Only the signed-in member's own contribution breakdown — every expense
  // they were split into, and exactly what their share of it was. Other
  // members' rows never compute or expose this, so nobody can see anyone
  // else's split-by-split detail, only their own.
  const myExpenseRows = useMemo(() => {
    return store.expenses
      .filter((e) => e.groupId === group.id)
      .flatMap((e) => {
        const share = e.shares.find((s) => s.memberId === me.id);
        if (!share) return [];
        const payer = group.members.find((m) => m.id === e.paidBy);
        return [
          {
            id: e.id,
            title: e.title,
            createdAt: e.createdAt,
            share: share.amount,
            paidByName: payer?.name ?? "—",
            paidBySelf: e.paidBy === me.id,
          },
        ];
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [store.expenses, group.id, group.members, me.id]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || submitting) return;
    setSubmitting(true);
    try {
      await store.addMember(group.id, name.trim(), email.trim());
      setName("");
      setEmail("");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName}?`)) return;
    setRemovingId(memberId);
    try {
      await store.removeMember(group.id, memberId);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <AppShell>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {group.members.length} people in {group.name}.
          </p>
        </div>
      </div>

      {canManage && (
        <form
          onSubmit={add}
          className="mb-8 flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-black/5 sm:flex-row sm:items-end"
        >
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Email
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="email@hostel.in"
              className="w-full rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <button
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
          >
            <UserPlus className="size-4" /> {submitting ? "Adding…" : "Add"}
          </button>
        </form>
      )}

      {/* Mobile: one card per member, no horizontal scroll */}
      <div className="space-y-3 md:hidden">
        {group.members.map((m) => {
          const b = balances[m.id] ?? { deposited: 0, spent: 0, balance: 0 };
          return (
            <div key={m.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="size-9 shrink-0 rounded-full ring-1 ring-black/5"
                    style={{ backgroundColor: `hsl(${m.avatarHue} 45% 82%)` }}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                {canManage && m.role !== "admin" && (
                  <button
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-brand/10 hover:text-brand disabled:opacity-50"
                    onClick={() => remove(m.id, m.name)}
                    disabled={removingId === m.id}
                    title="Remove"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Role
                  </p>
                  <span
                    className={
                      "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                      (m.role === "admin"
                        ? "bg-brand/10 text-brand"
                        : "bg-surface text-muted-foreground")
                    }
                  >
                    {m.role}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Deposited
                  </p>
                  <p className="mt-1 text-sm font-medium">{formatINR(b.deposited)}</p>
                </div>
                <div className={m.id === me.id ? "cursor-pointer select-none" : ""}>
                  <button
                    type="button"
                    disabled={m.id !== me.id}
                    onClick={() => m.id === me.id && setExpanded((v) => !v)}
                    className="flex items-center gap-1 text-left disabled:cursor-default"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Spent
                    </p>
                    {m.id === me.id && (
                      <ChevronDown
                        className={
                          "size-3 text-muted-foreground transition-transform " +
                          (expanded ? "rotate-180" : "")
                        }
                      />
                    )}
                  </button>
                  <p className="mt-1 text-sm font-medium">{formatINR(b.spent)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Balance
                  </p>
                  <p className={"mt-1 text-sm font-semibold " + (b.balance >= 0 ? "text-positive" : "text-brand")}>
                    {b.balance >= 0 ? "+" : ""}
                    {formatINR(b.balance)}
                  </p>
                </div>
              </div>

              {m.id === me.id && expanded && (
                <div className="mt-3 -mx-4 -mb-4 rounded-b-2xl border-t border-border bg-surface/50 px-4 pb-4 pt-3">
                  <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Receipt className="size-3" />
                    Your split-by-split contributions
                  </div>
                  {myExpenseRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No expenses split with you yet.</p>
                  ) : (
                    <ul className="divide-y divide-border/70 overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
                      {myExpenseRows.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium leading-tight">{row.title}</p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {formatDate(row.createdAt)} · paid by{" "}
                              {row.paidBySelf ? "you" : row.paidByName}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-foreground">
                            {formatINR(row.share)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: full table */}
      <div className="hidden rounded-2xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Deposited</th>
              <th className="px-4 py-3 font-medium">Spent</th>
              <th className="px-4 py-3 text-right font-medium">Balance</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-950/5">
            {group.members.map((m) => {
              const b = balances[m.id] ?? { deposited: 0, spent: 0, balance: 0 };
              const isMe = m.id === me.id;
              const showPanel = isMe && expanded;
              return (
                <Fragment key={m.id}>
                  <tr
                    className={
                      "hover:bg-surface/50 " + (showPanel ? "bg-surface/50" : "")
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-8 shrink-0 rounded-full ring-1 ring-black/5"
                          style={{ backgroundColor: `hsl(${m.avatarHue} 45% 82%)` }}
                        />
                        <div>
                          <p className="font-medium">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider " +
                          (m.role === "admin"
                            ? "bg-brand/10 text-brand"
                            : "bg-surface text-muted-foreground")
                        }
                      >
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatINR(b.deposited)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {isMe ? (
                        <button
                          type="button"
                          onClick={() => setExpanded((v) => !v)}
                          className="inline-flex items-center gap-1 rounded-md hover:text-foreground"
                          title="Show your split-by-split contributions"
                        >
                          {formatINR(b.spent)}
                          <ChevronDown
                            className={
                              "size-3 transition-transform " + (expanded ? "rotate-180" : "")
                            }
                          />
                        </button>
                      ) : (
                        formatINR(b.spent)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span className={b.balance >= 0 ? "text-positive" : "text-brand"}>
                        {b.balance >= 0 ? "+" : ""}
                        {formatINR(b.balance)}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        {m.role !== "admin" && (
                          <button
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-brand/10 hover:text-brand disabled:opacity-50"
                            onClick={() => remove(m.id, m.name)}
                            disabled={removingId === m.id}
                            title="Remove"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                  {showPanel && (
                    <tr className="bg-surface/50">
                      <td colSpan={canManage ? 6 : 5} className="px-4 pb-4 pt-0">
                        <div className="ml-11 rounded-xl bg-card ring-1 ring-black/5">
                          <div className="flex items-center gap-1.5 border-b border-border/70 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            <Receipt className="size-3" />
                            Your split-by-split contributions
                          </div>
                          {myExpenseRows.length === 0 ? (
                            <p className="px-3 py-2.5 text-sm text-muted-foreground">
                              No expenses split with you yet.
                            </p>
                          ) : (
                            <ul className="divide-y divide-border/70">
                              {myExpenseRows.map((row) => (
                                <li
                                  key={row.id}
                                  className="flex items-center justify-between gap-3 px-3 py-2"
                                >
                                  <span className="text-foreground">{row.title}</span>
                                  <span className="text-muted-foreground">
                                    {formatDate(row.createdAt)} · paid by{" "}
                                    {row.paidBySelf ? "you" : row.paidByName}
                                  </span>
                                  <span className="font-medium">{formatINR(row.share)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}