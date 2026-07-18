import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Receipt,
  Users,
  PiggyBank,
  BarChart3,
  UserCircle2,
  LogOut,
  Check,
  ChevronDown,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useCurrentGroup, useCurrentMember, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/deposits/new", label: "Add Deposit", icon: PiggyBank, adminOnly: true },
  { to: "/members", label: "Members", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/profile", label: "Profile", icon: UserCircle2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { loading: authLoading, user } = useAuth();
  const store = useStore();
  const group = useCurrentGroup();
  const me = useCurrentMember();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [groupOpen, setGroupOpen] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const [navOpen, setNavOpen] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!groupOpen && !navOpen && !profileOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (groupOpen && groupMenuRef.current && !groupMenuRef.current.contains(target)) {
        setGroupOpen(false);
      }
      if (navOpen && navMenuRef.current && !navMenuRef.current.contains(target)) {
        setNavOpen(false);
      }
      if (profileOpen && profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [groupOpen, navOpen, profileOpen]);

  const needsAuth = !authLoading && !user;
  // A brand-new user with no jar yet is a normal, valid state — never force
  // them into /onboarding. The dashboard is the only place that knows how
  // to show the "no jar yet, here's a Create jar button" empty state, so
  // any other page (expenses, members, reports, ...) just sends them back
  // to the dashboard instead of crashing on a missing group.
  const hasNoGroup = !authLoading && !store.loading && !!user && !group;
  const isDashboard = path === "/dashboard";

  useEffect(() => {
    if (needsAuth) navigate({ to: "/" });
  }, [needsAuth, navigate]);

  useEffect(() => {
    if (hasNoGroup && !isDashboard) navigate({ to: "/dashboard" });
  }, [hasNoGroup, isDashboard, navigate]);

  if (needsAuth || authLoading || store.loading) {
    return <FullScreenSpinner />;
  }

  // No jar yet: render a minimal header (no group switcher, no nav — none
  // of it applies until there's a group) and let the page's own content
  // (the dashboard's empty state) show through.
  if (hasNoGroup) {
    if (!isDashboard) return <FullScreenSpinner />; // brief flash before the redirect above fires
    return (
      <div className="min-h-screen bg-background text-foreground selection:bg-brand/15">
        <header className="sticky top-0 z-20 border-b border-stone-200/60 bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <Link
              to="/dashboard"
              className="flex size-9 items-center justify-center rounded-lg bg-brand text-brand-foreground"
            >
              <div className="size-4 rounded-full border-2 border-current" />
            </Link>
            <SignOutLink />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
      </div>
    );
  }

  // Extremely unlikely (RLS guarantees the fetched group has us as a
  // member) — show a spinner instead of crashing on `me.role`.
  if (!me) return <FullScreenSpinner />;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-brand/15">
      <header className="sticky top-0 z-20 border-b border-stone-200/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="relative md:hidden" ref={navMenuRef}>
              <button
                onClick={() => setNavOpen((v) => !v)}
                aria-label="Open navigation menu"
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                {navOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
              {navOpen && (
                <div className="absolute left-0 top-full mt-1 w-52 rounded-xl border border-border bg-popover p-1 shadow-lg">
                  {NAV.filter((n) => n.to !== "/profile" && (!n.adminOnly || me.role === "admin")).map((n) => {
                    const active = path === n.to || (n.to !== "/dashboard" && path.startsWith(n.to));
                    const Icon = n.icon;
                    return (
                      <Link
                        key={n.to}
                        to={n.to}
                        onClick={() => setNavOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                          active ? "bg-surface text-foreground" : "text-muted-foreground hover:bg-surface hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                        {n.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <Link
              to="/dashboard"
              className="hidden size-9 items-center justify-center rounded-lg bg-brand text-brand-foreground md:flex"
            >
              <div className="size-4 rounded-full border-2 border-current" />
            </Link>
            <div className="relative" ref={groupMenuRef}>
              <button
                onClick={() => setGroupOpen((v) => !v)}
                className="flex items-center gap-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {group.name}
                <ChevronDown className="size-3.5" />
              </button>
              {groupOpen && (
                <div className="absolute left-0 top-full mt-1 w-56 rounded-xl border border-border bg-popover p-1 shadow-lg">
                  {store.groups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => {
                        store.setCurrentGroupId(g.id);
                        setGroupOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface",
                        g.id === group.id && "bg-surface",
                      )}
                    >
                      <span>{g.name}</span>
                      {g.id === group.id && <Check className="size-4 text-brand" />}
                    </button>
                  ))}
                  <div className="my-1 border-t border-border" />
                  <button
                    type="button"
                    onClick={() => {
                      setGroupOpen(false);
                      navigate({ to: "/onboarding" });
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-surface"
                  >
                    + Create new group
                  </button>
                </div>
              )}
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.filter((n) => !n.adminOnly || me.role === "admin").map((n) => {
              const active = path === n.to || (n.to !== "/dashboard" && path.startsWith(n.to));
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-surface text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-surface"
            >
              <div
                className="size-8 rounded-full ring-1 ring-black/5"
                style={{ backgroundColor: `hsl(${me.avatarHue} 45% 78%)` }}
              />
              <span className="hidden text-sm font-medium sm:inline">{me.name.split(" ")[0]}</span>
              <span className="hidden rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand sm:inline">
                {me.role}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-border bg-popover p-1 shadow-lg">
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-surface hover:text-foreground"
                >
                  <UserCircle2 className="size-4" />
                  Profile
                </Link>
                <div className="my-1 border-t border-border" />
                <SignOutMenuItem />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}

function SignOutMenuItem() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await signOut();
          navigate({ to: "/" });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not sign out");
        } finally {
          setBusy(false);
        }
      }}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-50"
    >
      <LogOut className="size-4" /> {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

function SignOutLink() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await signOut();
          navigate({ to: "/" });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not sign out");
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-50"
    >
      <LogOut className="size-3" /> {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}