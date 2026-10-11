import type { Metadata } from "next";
import { AuthShell, ResetFlow } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Reset password" };

export default function Reset() {
  return (
    <AuthShell title="Reset your password" subtitle="We’ll send a code to your verified phone number.">
      <ResetFlow />
    </AuthShell>
  );
}
