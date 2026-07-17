import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { formatINR, useCurrentGroup, useCurrentMember, useStore } from "@/lib/store";
import { apiErrorMessage } from "@/lib/api";

export const Route = createFileRoute("/expenses/new")({
  head: () => ({
    meta: [
      { title: "Add expense — Hostel Fund Manager" },
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

  const share = useMemo(() => {
    const amt = parseFloat(amount) || 0;
    return participants.size > 0 ? amt / participants.size : 0;
  }, [amount, participants]);

  const toggle = (id: string) => {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [submitting, setSubmitting] = useState(false);
  const canSubmit = title.trim() && parseFloat(amount) > 0 && participants.size > 0 && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await store.addExpense({
        groupId: group.id,
        title: title.trim(),
        amount: parseFloat(amount),
        paidBy,
        participantIds: Array.from(participants),
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
        <h1 className="font-display text-4xl">New receipt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log a shared expense. It splits equally between whoever you check.
        </p>

        <form
          onSubmit={submit}
          className="mt-8 space-y-6 rounded-3xl bg-card p-8 ring-1 ring-black/5"
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
                placeholder="0"
                min="0"
                step="1"
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

          <div className="flex items-center justify-between rounded-xl bg-brand/5 p-4">
            <span className="text-sm text-muted-foreground">Per person share</span>
            <span className="text-xl font-semibold text-brand">{formatINR(share)}</span>
          </div>

          <div className="flex justify-end gap-3">
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
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
