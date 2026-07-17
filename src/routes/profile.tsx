import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useCurrentGroup, useCurrentMember } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { updateProfileName, apiErrorMessage } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

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

  const [name, setName] = useState(me?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!me || !group || !user) return null;

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
