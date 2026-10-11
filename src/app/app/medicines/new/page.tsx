"use client";

import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/hooks";
import { addMedicine } from "@/lib/actions";
import { emptyDraft, MedicineForm } from "@/components/MedicineForm";
import { Callout, Card, LoadingPage, PageHeader, toast } from "@/components/ui";

export default function NewMedicine() {
  const ws = useWorkspace();
  const router = useRouter();
  if (!ws) return <LoadingPage />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add a medicine" subtitle={`For ${ws.profile.displayName}. Enter details exactly as your prescription or pharmacist label says.`} />
      <Callout tone="info" className="mb-5">
        Have a prescription? <a href="/app/documents/upload?type=prescription" className="font-medium underline">Upload it instead</a> so the original stays linked to this medicine.
      </Callout>
      <Card className="p-5">
        <MedicineForm
          initial={emptyDraft(ws.state.settings.timezone)}
          submitLabel="Save medicine"
          onSubmit={(d) => {
            addMedicine({ ...d, profileId: ws.profileId, status: "active" });
            toast(`${d.name} added`);
            router.push("/app/medicines?tab=list");
          }}
        />
      </Card>
    </div>
  );
}
