import { SignIn } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { Github } from "lucide-react";

/**
 * Hosted Clerk sign-in. We use Clerk's prebuilt component for the auth UI —
 * it's accessible, handles 2FA, passwordless, social, etc., and we get to
 * skip writing/maintaining our own forms (which is a security risk if done
 * wrong).
 */
export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="container h-16 flex items-center">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <BrandLogo textClassName="text-[15px]" />
        </Link>
      </header>
      <main className="flex-1 grid place-items-center px-4 py-10">
        <SignIn
          // After signing in, send the user to start a clone. Clerk handles
          // the return-URL handoff for OAuth callbacks.
          signUpUrl="/sign-up"
          forceRedirectUrl="/app/new"
          fallbackRedirectUrl="/app/new"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-card border border-border/60 shadow-soft",
              formButtonPrimary: "bg-primary text-primary-foreground",
            },
          }}
        />
      </main>
      <footer className="container py-6 text-xs text-muted-foreground flex justify-between">
        <span>By signing in you agree to our <Link to="/legal/terms" className="underline hover:text-foreground">Terms</Link> and <Link to="/legal/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.</span>
        <a className="inline-flex items-center gap-1.5 hover:text-foreground" href="#"><Github className="w-3.5 h-3.5" /> GitHub</a>
      </footer>
    </div>
  );
}
