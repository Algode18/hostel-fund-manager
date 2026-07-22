import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { authErrorMessage, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Expense Splitter" },
      { name: "description", content: "Sign in to your hostel fund." },
    ],
  }),
  component: LoginPage,
});

type Mode = "sign-in" | "sign-up";

function LoginPage() {
  const { user, loading, signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Already signed in? Skip the login screen entirely.
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === "sign-up") {
        if (!name.trim()) throw new Error("Please enter your name.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        await signUp(email, password, name);
        toast.success(
          "Account created — check your email if confirmation is required, then sign in.",
        );
        setMode("sign-in");
      } else {
        await signIn(email, password);
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const google = async () => {
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
      // supabase redirects the browser away — nothing more to do here.
    } catch (err) {
      toast.error(authErrorMessage(err));
      setGoogleBusy(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
            <div className="size-6 rounded-full border-[3px] border-current" />
          </div>
          <div>
            <h1 className="font-display text-4xl text-foreground">Expense Splitter</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The shared jar for your group — deposits in, expenses out, balances always honest.
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-card p-8 shadow-sm ring-1 ring-black/5">
          <button
            type="button"
            onClick={google}
            disabled={googleBusy}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-surface disabled:opacity-50"
          >
            <GoogleG />
            {googleBusy ? "Redirecting…" : "Continue with Google"}
          </button>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "sign-up" && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                autoComplete="name"
                className="w-full rounded-xl bg-surface px-4 py-3 text-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-brand"
              />
            )}
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="you@hostel.in"
              autoComplete="email"
              className="w-full rounded-xl bg-surface px-4 py-3 text-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={6}
              placeholder="Password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              className="w-full rounded-xl bg-surface px-4 py-3 text-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-brand py-3 text-center text-sm font-medium text-brand-foreground transition-transform hover:bg-brand/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Please wait…" : mode === "sign-up" ? "Create account" : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode((m) => (m === "sign-in" ? "sign-up" : "sign-in"))}
            className="mt-4 w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {mode === "sign-in"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}
