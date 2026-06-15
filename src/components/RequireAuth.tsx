import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

/**
 * Gates any subtree on a signed-in user. Out-of-the-box Clerk handles
 * sign-in redirects via `<SignIn />`; here we render a friendly page that
 * prompts the user to sign in if they're not.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <SignedOutPanel />
      </SignedOut>
    </>
  );
}

function SignedOutPanel() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="max-w-md w-full glass rounded-2xl p-8 text-center">
        <div className="mx-auto w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
          <ShieldCheck className="w-5 h-5 text-primary-foreground" />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Sign in to continue</h1>
        <p className="text-sm text-muted-foreground mt-2">
          You need an account to start a clone and view your projects.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
          <SignInButton mode="modal" forceRedirectUrl={pathname} fallbackRedirectUrl={pathname}>
            <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow w-full sm:w-auto">
              Sign in
            </Button>
          </SignInButton>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Re-export the signed-in / signed-out primitives for callers that want them. */
export { SignedIn, SignedOut, SignInButton, UserButton };
