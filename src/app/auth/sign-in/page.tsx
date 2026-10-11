import type { Metadata } from "next";
import { AuthShell, SignInFlow } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Sign in" };

export default function SignIn() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in with your phone number and HealthOS password, or with Google.">
      <SignInFlow />
    </AuthShell>
  );
}
