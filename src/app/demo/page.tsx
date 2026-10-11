"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startDemo } from "@/lib/store";
import { LoadingPage } from "@/components/ui";

export default function DemoStart() {
  const router = useRouter();
  useEffect(() => {
    startDemo();
    router.replace("/app");
  }, [router]);
  return (
    <main id="main" className="mx-auto max-w-3xl p-8">
      <p className="mb-6 text-muted">Preparing the sample workspace…</p>
      <LoadingPage />
    </main>
  );
}
