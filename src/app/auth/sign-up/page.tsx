import type { Metadata } from "next";
import { AuthShell, SignUpFlow } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Create account" };

export default function SignUp() {
  return (
    <AuthShell title="Create your account" subtitle="Verify your phone number, then set a HealthOS password.">
      <SignUpFlow />
    </AuthShell>
  );
}
