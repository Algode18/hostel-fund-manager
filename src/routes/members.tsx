import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import {
  computeBalances,
  formatINR,
  useCurrentGroup,
  useCurrentMember,
  useStore,
} from "@/lib/store";
import { apiErrorMessage } from "@/lib/api";

export const Route = createFileRoute("/members")({
  head: () => ({
    meta: [
      { title: "Members — Hostel Fund Manager" },
      { name: "description", content: "The roommates in your fund." },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const group = useCurrentGroup();
  const me = useCurrentMember();
  const store = useStore();
  const navigate = useNavigate();
  const balances = computeBalances(group, store.deposits, store.expenses);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canManage = me.role === "admin";

  const clearBalance = async () => {
    if (
      !confirm(
        `Clear all deposits and expenses in "${group.name}"? Members stay in the group, but every money record is wiped. This can't be undone.`,
      )
    )
      return;
    setClearing(true);
    try {
      await store.clearJarBalance(group.id);
      toast.success("Jar balance cleared");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setClearing(false);
    }
  };

  const removeGroup = async () => {
    const typed = prompt(
      `This permanently deletes "${group.name}" and every deposit, expense, and member record in it. This can't be undone.\n\nType the group name to confirm:`,
    );
    if (typed !== group.name) {
      if (typed !== null) toast.error("Name didn't match — group was not deleted.");
      return;
    }
    setDeleting(true);
    try {
      await store.deleteGroup(group.id);
      toast.success("Group deleted");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setDeleting(false);
    }
  };

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

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
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
              return (
                <tr key={m.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="size-8 rounded-full ring-1 ring-black/5"
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
                  <td className="px-4 py-3 text-muted-foreground">{formatINR(b.spent)}</td>
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
              );
            })}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="mt-10 rounded-2xl border border-brand/20 bg-brand/5 p-5">
          <div className="mb-4 flex items-center gap-2 text-brand">
            <AlertTriangle className="size-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Danger Zone</h2>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Clear jar balance</p>
              <p className="text-xs text-muted-foreground">
                Deletes all deposits and expenses. Members stay in the group.
              </p>
            </div>
            <button
              onClick={clearBalance}
              disabled={clearing}
              className="inline-flex items-center gap-2 rounded-lg bg-background px-4 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-surface disabled:opacity-50"
            >
              <RotateCcw className="size-4" /> {clearing ? "Clearing…" : "Clear balance"}
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-4 border-t border-brand/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Delete group</p>
              <p className="text-xs text-muted-foreground">
                Permanently deletes the group, its members, and all money history.
              </p>
            </div>
            <button
              onClick={removeGroup}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              <Trash2 className="size-4" /> {deleting ? "Deleting…" : "Delete group"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}