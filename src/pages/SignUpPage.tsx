import { SignUp } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="container h-16 flex items-center">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <BrandLogo textClassName="text-[15px]" />
        </Link>
      </header>
      <main className="flex-1 grid place-items-center px-4 py-10">
        <SignUp
          signInUrl="/sign-in"
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
      <footer className="container py-6 text-xs text-muted-foreground">
        By signing up you agree to our <Link to="/legal/terms" className="underline hover:text-foreground">Terms</Link> and <Link to="/legal/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
      </footer>
    </div>
  );
}
