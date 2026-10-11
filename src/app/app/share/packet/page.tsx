"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { useWorkspace } from "@/lib/hooks";
import { PacketView } from "@/components/PacketView";
import { Button, LoadingPage } from "@/components/ui";

export default function PacketPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <Packet />
    </Suspense>
  );
}

function Packet() {
  const ws = useWorkspace();
  const p = useSearchParams();
  if (!ws) return <LoadingPage />;
  return (
    <div>
      <div className="no-print mb-6 flex items-center justify-between gap-3 rounded-2xl bg-pine-soft px-4 py-3">
        <p className="text-sm text-ink-2">Use your browser’s print dialog and choose “Save as PDF”.</p>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden /> Print or save PDF
        </Button>
      </div>
      <PacketView state={ws.state} profileId={ws.profileId} documentIds={(p.get("docs") ?? "").split(",").filter(Boolean)} meds={p.get("meds") === "1"} appts={p.get("appts") === "1"} heading="Health records packet" />
    </div>
  );
}
