import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { apiErrorMessage } from "@/lib/api";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Create a group — Hostel Fund Manager" },
      { name: "description", content: "Set up your hostel fund and invite your roommates." },
    ],
  }),
  component: OnboardingPage,
});

type Row = { name: string; email: string };

function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState("");
  const [rows, setRows] = useState<Row[]>([{ name: "", email: "" }]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/" });
  }, [authLoading, user, navigate]);

  const update = (i: number, key: keyof Row, val: string) => {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));
  };
  const addRow = () => setRows((r) => [...r, { name: "", email: "" }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || submitting) return;
    setSubmitting(true);
    try {
      const clean = rows.filter((r) => r.name.trim() && r.email.trim());
      await store.addGroup(groupName.trim(), clean);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center sm:mb-10">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
            <div className="size-5 rounded-full border-2 border-current" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl">Start a new jar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Name your group and add your roommates. You'll be the admin. Roommates you add here will
            automatically join the group the moment they sign up with the same email.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-8 rounded-2xl bg-card p-5 ring-1 ring-black/5 sm:rounded-3xl sm:p-8">
          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Group name
            </span>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Room 302"
              autoFocus
              className="w-full rounded-xl bg-surface px-4 py-3 text-lg font-medium ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>

          <div>
            <span className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Initial members
            </span>
            <div className="space-y-3">
              {rows.map((row, i) => (
                <div key={i} className="relative rounded-xl bg-surface p-3 pr-10 ring-1 ring-black/5">
                  <div className="space-y-2">
                    <input
                      value={row.name}
                      onChange={(e) => update(i, "name", e.target.value)}
                      placeholder="Name"
                      className="w-full rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                    <input
                      value={row.email}
                      onChange={(e) => update(i, "email", e.target.value)}
                      type="email"
                      placeholder="email@hostel.in"
                      className="w-full rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      aria-label="Remove member"
                      className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-card hover:text-brand"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRow}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-black/15 py-2.5 text-xs font-medium text-brand hover:bg-surface"
            >
              <Plus className="size-3.5" /> Add another roommate
            </button>
          </div>

          <button
            type="submit"
            disabled={!groupName.trim() || submitting}
            className="w-full rounded-xl bg-brand py-3 text-sm font-medium text-brand-foreground shadow-sm transition-transform hover:bg-brand/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Creating…" : "Create group"}
          </button>
        </form>
      </div>
    </div>
  );
}