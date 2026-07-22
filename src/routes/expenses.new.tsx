import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { formatINR, useCurrentGroup, useCurrentMember, useStore } from "@/lib/store";
import { apiErrorMessage, computeEqualShares, type SplitType } from "@/lib/api";

export const Route = createFileRoute("/expenses/new")({
  head: () => ({
    meta: [
      { title: "Add expense — Expense Splitter" },
      { name: "description", content: "Log a shared expense and split it fairly." },
    ],
  }),
  component: NewExpensePage,
});

function NewExpensePage() {
  const group = useCurrentGroup();
  const me = useCurrentMember();
  const store = useStore();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(me.id);
  const [participants, setParticipants] = useState<Set<string>>(
    new Set(group.members.map((m) => m.id)),
  );
  const [splitType, setSplitType] = useState<SplitType>("equal");
  // Manual per-person amounts, keyed by member id, kept as raw text so the
  // person can clear a field or type "3.5" without fighting the input.
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});

  const amt = parseFloat(amount) || 0;
  const participantIds = useMemo(() => Array.from(participants), [participants]);

  const equalShares = useMemo(
    () => computeEqualShares(amt, participantIds),
    [amt, participantIds],
  );

  const manualTotal = useMemo(
    () =>
      participantIds.reduce((sum, id) => sum + (parseFloat(manualAmounts[id] ?? "") || 0), 0),
    [manualAmounts, participantIds],
  );
  const manualRemaining = Math.round((amt - manualTotal) * 100) / 100;
  const manualBalances = Math.abs(manualRemaining) < 0.01;

  const toggle = (id: string) => {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [submitting, setSubmitting] = useState(false);
  const canSubmit =
    !!title.trim() &&
    amt > 0 &&
    participantIds.length > 0 &&
    !submitting &&
    (splitType === "equal" || manualBalances);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const shares =
        splitType === "equal"
          ? equalShares
          : participantIds.map((memberId) => ({
              memberId,
              amount: Math.round((parseFloat(manualAmounts[memberId] ?? "") || 0) * 100) / 100,
            }));

      await store.addExpense({
        groupId: group.id,
        title: title.trim(),
        amount: amt,
        paidBy,
        splitType,
        shares,
      });
      navigate({ to: "/expenses" });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl sm:text-4xl">New receipt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log a shared expense — split it equally, or type each person's exact share.
        </p>

        <form
          onSubmit={submit}
          className="mt-6 space-y-6 rounded-2xl bg-card p-5 ring-1 ring-black/5 sm:mt-8 sm:rounded-3xl sm:p-8"
        >
          <Field label="Description">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What did you buy?"
              className="input"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount (₹)">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="input"
              />
            </Field>
            <Field label="Paid by">
              <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className="input">
                {group.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Split between">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {group.members.map((m) => {
                const on = participants.has(m.id);
                return (
                  <label
                    key={m.id}
                    className={
                      "flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 transition-colors " +
                      (on
                        ? "bg-brand/5 ring-brand/30"
                        : "bg-surface ring-black/5 hover:ring-black/10")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(m.id)}
                      className="size-4 accent-brand"
                    />
                    <span className="text-sm font-medium">{m.name.split(" ")[0]}</span>
                  </label>
                );
              })}
            </div>
          </Field>

          <Field label="Split type">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 ring-1 ring-black/5 sm:inline-flex sm:w-auto">
              <button
                type="button"
                onClick={() => setSplitType("equal")}
                className={
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors " +
                  (splitType === "equal"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                Split equally
              </button>
              <button
                type="button"
                onClick={() => setSplitType("manual")}
                className={
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors " +
                  (splitType === "manual"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                Split manually
              </button>
            </div>
          </Field>

          {splitType === "equal" ? (
            <div className="flex items-center justify-between rounded-xl bg-brand/5 p-4">
              <span className="text-sm text-muted-foreground">Per person share</span>
              <span className="text-xl font-semibold text-brand">
                {formatINR(equalShares[0]?.amount ?? 0)}
              </span>
            </div>
          ) : (
            <Field label="Each person's exact share (₹)">
              <div className="space-y-2">
                {participantIds.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Check at least one person above first.
                  </p>
                )}
                {participantIds.map((id) => {
                  const m = group.members.find((x) => x.id === id);
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm font-medium">
                        {m?.name.split(" ")[0]}
                      </span>
                      <input
                        type="number"
                        value={manualAmounts[id] ?? ""}
                        onChange={(e) =>
                          setManualAmounts((prev) => ({ ...prev, [id]: e.target.value }))
                        }
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="input"
                      />
                    </div>
                  );
                })}
              </div>
              {participantIds.length > 0 && (
                <p
                  className={
                    "mt-3 text-sm font-medium " +
                    (manualBalances ? "text-muted-foreground" : "text-brand")
                  }
                >
                  {manualBalances
                    ? `Shares add up to ${formatINR(manualTotal)}.`
                    : manualRemaining > 0
                      ? `${formatINR(manualRemaining)} left to assign.`
                      : `${formatINR(Math.abs(manualRemaining))} too much — reduce a share.`}
                </p>
              )}
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
            <button
              type="button"
              onClick={() => navigate({ to: "/expenses" })}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-xl bg-brand px-6 py-2.5 text-sm font-medium text-brand-foreground shadow-sm transition-transform hover:bg-brand/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Saving…" : "Drop into jar"}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: var(--color-surface);
          border: none;
          box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.05);
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          outline: none;
          transition: box-shadow 0.15s;
        }
        .input:focus {
          box-shadow: inset 0 0 0 2px var(--color-brand);
        }
      `}</style>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}