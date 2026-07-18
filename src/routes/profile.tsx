import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useCurrentGroup, useCurrentMember, useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { updateProfileName, apiErrorMessage } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, AlertTriangle, RotateCcw, Trash2 } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Hostel Fund Manager" },
      { name: "description", content: "Your profile and settings." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const me = useCurrentMember();
  const group = useCurrentGroup();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const store = useStore();

  const [name, setName] = useState(me?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!me || !group || !user) return null;

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

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await updateProfileName(name.trim());
      await queryClient.invalidateQueries({ queryKey: ["groups", user.id] });
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign out");
      setSigningOut(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-4xl">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account and group details.</p>

        <div className="mt-8 rounded-3xl bg-card p-8 ring-1 ring-black/5">
          <div className="flex items-center gap-5">
            <div
              className="size-20 rounded-full ring-1 ring-black/5"
              style={{ backgroundColor: `hsl(${me.avatarHue} 45% 78%)` }}
            />
            <div>
              <h2 className="font-display text-2xl">{me.name}</h2>
              <p className="text-sm text-muted-foreground">{me.email}</p>
              <span className="mt-2 inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-brand">
                {me.role} · {group.name}
              </span>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Display name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-surface px-4 py-3 text-sm font-medium ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
            <Field label="Email" value={me.email} />
            <Field label="Group" value={group.name} />
            <Field label="Role" value={me.role} />
          </div>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-6">
            <button
              onClick={save}
              disabled={saving || !name.trim()}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              onClick={logout}
              disabled={signingOut}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-50"
            >
              <LogOut className="size-4" /> {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>

        {canManage && (
          <div className="mt-6 rounded-2xl border border-brand/20 bg-brand/5 p-5">
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
      </div>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-black/5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium capitalize">{value}</p>
    </div>
  );
}