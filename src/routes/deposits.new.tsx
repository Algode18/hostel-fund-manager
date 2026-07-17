import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { formatDate, formatINR, useCurrentGroup, useCurrentMember, useStore } from "@/lib/store";
import { apiErrorMessage } from "@/lib/api";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/deposits/new")({
  head: () => ({
    meta: [
      { title: "Add deposit — Hostel Fund Manager" },
      { name: "description", content: "Admin-only: log a cash deposit into the fund." },
    ],
  }),
  component: NewDepositPage,
});

function NewDepositPage() {
  const group = useCurrentGroup();
  const me = useCurrentMember();
  const store = useStore();
  const navigate = useNavigate();
  const [memberId, setMemberId] = useState(group.members[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (me.role !== "admin") {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg rounded-3xl bg-card p-10 text-center ring-1 ring-black/5">
          <ShieldAlert className="mx-auto size-8 text-brand" />
          <h1 className="mt-4 font-display text-2xl">Admin only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Only the fund manager can log deposits. Ask your admin to add this cash entry.
          </p>
        </div>
      </AppShell>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !memberId || submitting) return;
    setSubmitting(true);
    try {
      await store.addDeposit(group.id, memberId, amt);
      setAmount("");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const groupDeposits = store.deposits
    .filter((d) => d.groupId === group.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  return (
    <AppShell>
      <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h1 className="font-display text-4xl">Log a deposit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record the cash you just received into the shared jar.
          </p>

          <form
            onSubmit={submit}
            className="mt-8 space-y-6 rounded-3xl bg-card p-8 ring-1 ring-black/5"
          >
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Member
              </span>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full rounded-xl bg-surface px-4 py-3 text-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {group.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Amount (₹)
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                min="1"
                step="1"
                className="w-full rounded-xl bg-surface px-4 py-3 text-lg font-semibold ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-brand"
                autoFocus
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-brand py-3 text-sm font-medium text-brand-foreground shadow-sm transition-transform hover:bg-brand/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save deposit"}
            </button>
          </form>
        </div>

        <aside className="lg:col-span-2">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent deposits
          </h2>
          <div className="divide-y divide-stone-950/5 rounded-2xl bg-surface ring-1 ring-black/5">
            {groupDeposits.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">No deposits yet.</p>
            )}
            {groupDeposits.map((d) => {
              const m = group.members.find((x) => x.id === d.memberId);
              return (
                <div key={d.id} className="flex items-center justify-between p-4 text-sm">
                  <div>
                    <p className="font-medium">{m?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</p>
                  </div>
                  <p className="font-semibold text-positive">+{formatINR(d.amount)}</p>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
