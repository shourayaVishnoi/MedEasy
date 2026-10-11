"use client";

import { useState } from "react";
import { CheckCircle2, Mail, Plus, ShieldOff, Trash2, UserPlus, UserRound } from "lucide-react";
import { useWorkspace } from "@/lib/hooks";
import { addHealthEntry, deleteProfile, grantAccess, removeHealthEntry, revokeGrant, saveProfile, verifyHealthEntry } from "@/lib/actions";
import type { HealthEntryKind, Profile, Relationship } from "@/lib/types";
import { Badge, Button, Callout, Card, CardHeader, ConfirmDialog, Field, Input, LoadingPage, Modal, PageHeader, Select, Textarea, toast } from "@/components/ui";
import { uid } from "@/lib/util";

const KINDS: { kind: HealthEntryKind; label: string; placeholder: string }[] = [
  { kind: "allergy", label: "Allergies", placeholder: "e.g. Penicillin – rash" },
  { kind: "condition", label: "Known conditions", placeholder: "As told by your clinician" },
  { kind: "surgery", label: "Past surgeries", placeholder: "e.g. Appendectomy, 2009" },
  { kind: "history", label: "Important medical history", placeholder: "" },
  { kind: "note", label: "Other notes", placeholder: "" },
];

const SOURCE_BADGE = {
  user: { label: "Entered by you", tone: "neutral" as const },
  document: { label: "From a document · unconfirmed", tone: "warn" as const },
  verified: { label: "Confirmed by you", tone: "ok" as const },
};

export default function ProfilePage() {
  const ws = useWorkspace();
  const [editing, setEditing] = useState<Profile | null>(null);
  const [inviting, setInviting] = useState(false);
  const [toDelete, setToDelete] = useState<Profile | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  if (!ws) return <LoadingPage />;
  const { state, profile, profileId } = ws;
  const entries = state.healthEntries.filter((e) => e.profileId === profileId);
  const grants = state.grants.filter((g) => g.profileId === profileId);
  const activeMeds = state.medicines.filter((m) => m.profileId === profileId && m.status === "active");

  return (
    <div>
      <PageHeader title="Profiles & family" subtitle="Each person’s records, schedules and sharing are kept completely separate." actions={<Button variant="secondary" onClick={() => setEditing({ id: uid("p"), displayName: "", relationship: "child", createdAt: new Date().toISOString() })}><Plus className="h-4 w-4" aria-hidden /> Add a person</Button>} />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state.profiles.map((p) => (
          <Card key={p.id} as="article" className={`p-4 ${p.id === profileId ? "ring-2 ring-pine/40" : ""}`}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-pine-soft font-semibold text-pine">{p.displayName.slice(0, 1) || "?"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.displayName}</p>
                <p className="text-sm capitalize text-muted">{p.relationship === "self" ? "You" : p.relationship}</p>
              </div>
              {p.id === profileId && <Badge tone="pine">Viewing</Badge>}
            </div>
            <p className="mt-3 text-xs text-muted">
              {state.documents.filter((d) => d.profileId === p.id).length} records · {state.grants.filter((g) => g.profileId === p.id && g.status === "active").length} people with access
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={`${profile.displayName}’s health profile`} subtitle="Optional. Fill in only what’s useful. Every entry shows where it came from." icon={<UserRound className="h-5 w-5" />} action={<Button size="sm" variant="ghost" onClick={() => setEditing(profile)}>Edit details</Button>} />
            <dl className="grid grid-cols-1 [&>*]:min-w-0 gap-x-6 gap-y-3 px-5 pb-5 pt-4 text-sm sm:grid-cols-2">
              {[
                ["Name", profile.displayName],
                ["Preferred name", profile.preferredName],
                ["Date of birth", profile.dateOfBirth],
                ["Emergency contact", profile.emergencyContact],
                ["Preferred healthcare provider", profile.preferredProvider],
                ["Current medicines (from your schedules)", activeMeds.map((m) => `${m.name}${m.strength ? ` ${m.strength}` : ""}`).join(", ") || undefined],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium">{v || <span className="font-normal text-muted">Not added</span>}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {KINDS.map(({ kind, label, placeholder }) => {
            const list = entries.filter((e) => e.kind === kind);
            return (
              <Card key={kind} className="p-5">
                <h2 className="font-semibold">{label}</h2>
                {list.length > 0 ? (
                  <ul className="mt-3 divide-y divide-line">
                    {list.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <span className="text-[0.95rem]">{e.text}</span>
                        <span className="flex items-center gap-1.5">
                          <Badge tone={SOURCE_BADGE[e.source].tone}>{SOURCE_BADGE[e.source].label}</Badge>
                          {e.source === "document" && (
                            <Button size="sm" variant="ghost" onClick={() => verifyHealthEntry(e.id)} aria-label="Confirm entry">
                              <CheckCircle2 className="h-4 w-4" aria-hidden />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => { removeHealthEntry(e.id); toast("Removed"); }} aria-label={`Remove ${e.text}`}>
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted">Nothing added.</p>
                )}
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = drafts[kind]?.trim();
                    if (!text) return;
                    addHealthEntry({ profileId, kind, text, source: "user" });
                    setDrafts({ ...drafts, [kind]: "" });
                  }}
                >
                  <Input aria-label={`Add to ${label}`} placeholder={placeholder || "Add an entry"} value={drafts[kind] ?? ""} onChange={(e) => setDrafts({ ...drafts, [kind]: e.target.value })} />
                  <Button type="submit" variant="quiet">
                    Add
                  </Button>
                </form>
              </Card>
            );
          })}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Who can access this profile" subtitle="Access is only by explicit invitation and can be revoked at any time." icon={<UserPlus className="h-5 w-5" />} />
            <ul className="divide-y divide-line px-5 pt-3">
              {grants.length === 0 && <li className="py-3 text-sm text-muted">Only you.</li>}
              {grants.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="flex items-center gap-1.5 font-medium">
                      <Mail className="h-4 w-4 text-muted" aria-hidden />
                      {g.granteeEmail}
                    </p>
                    <p className="text-muted">
                      Can {g.role === "viewer" ? "view" : "view and edit"} · since {new Date(g.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5">
                    <Badge tone={g.status === "active" ? "ok" : g.status === "pending" ? "warn" : "neutral"}>{g.status === "active" ? "Active" : g.status === "pending" ? "Invitation pending" : "Revoked"}</Badge>
                    {g.status !== "revoked" && (
                      <Button size="sm" variant="ghost" onClick={() => { revokeGrant(g.id); toast("Access revoked"); }}>
                        <ShieldOff className="h-4 w-4" aria-hidden /> Revoke
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div className="p-5 pt-3">
              <Button variant="secondary" onClick={() => setInviting(true)} className="w-full">
                Invite a caregiver
              </Button>
            </div>
          </Card>
          <Callout tone="info" title="Family isn’t automatic access">
            Being related to someone doesn’t grant access to an adult’s records. Each person (or their legal guardian) decides who can see their profile.
          </Callout>
          {profile.relationship !== "self" && (
            <Card className="p-5">
              <h2 className="font-semibold">Delete this profile</h2>
              <p className="mt-1 text-sm text-muted">Deletes {profile.displayName}’s records, schedules, history and sharing.</p>
              <Button variant="danger" size="sm" className="mt-3" onClick={() => setToDelete(profile)}>
                Delete profile
              </Button>
            </Card>
          )}
        </div>
      </div>

      {editing && <ProfileForm profile={editing} onClose={() => setEditing(null)} />}
      {inviting && <InviteForm profileId={profileId} name={profile.displayName} onClose={() => setInviting(false)} />}
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} danger title={`Delete ${toDelete?.displayName}’s profile?`} confirmLabel="Delete profile and records" onConfirm={() => { if (toDelete) deleteProfile(toDelete.id); toast("Profile deleted"); }}>
        All records, extracted values, medicine schedules, dose history, appointments and share links for this profile will be deleted from this workspace. This can’t be undone.
      </ConfirmDialog>
    </div>
  );
}

function ProfileForm({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [p, setP] = useState(profile);
  return (
    <Modal
      open
      onClose={onClose}
      title={profile.displayName ? "Edit profile" : "Add a person"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!p.displayName.trim()} onClick={() => { saveProfile(p); toast("Profile saved"); onClose(); }}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-3 sm:grid-cols-2">
        <Field label="Name" required>{(id) => <Input id={id} value={p.displayName} onChange={(e) => setP({ ...p, displayName: e.target.value })} />}</Field>
        <Field label="Preferred name">{(id) => <Input id={id} value={p.preferredName ?? ""} onChange={(e) => setP({ ...p, preferredName: e.target.value || undefined })} />}</Field>
        <Field label="Relationship to you">
          {(id) => (
            <Select id={id} value={p.relationship} disabled={profile.relationship === "self"} onChange={(e) => setP({ ...p, relationship: e.target.value as Relationship })}>
              <option value="self">Me</option>
              <option value="child">Child</option>
              <option value="parent">Parent</option>
              <option value="partner">Partner</option>
              <option value="other">Someone I care for</option>
            </Select>
          )}
        </Field>
        <Field label="Date of birth">{(id) => <Input id={id} type="date" value={p.dateOfBirth ?? ""} onChange={(e) => setP({ ...p, dateOfBirth: e.target.value || undefined })} />}</Field>
        <Field label="Emergency contact">{(id) => <Input id={id} value={p.emergencyContact ?? ""} onChange={(e) => setP({ ...p, emergencyContact: e.target.value || undefined })} />}</Field>
        <Field label="Preferred healthcare provider">{(id) => <Input id={id} value={p.preferredProvider ?? ""} onChange={(e) => setP({ ...p, preferredProvider: e.target.value || undefined })} />}</Field>
        <div className="sm:col-span-2">
          <Field label="Notes">{(id) => <Textarea id={id} value={p.notes ?? ""} onChange={(e) => setP({ ...p, notes: e.target.value || undefined })} />}</Field>
        </div>
      </div>
      {p.relationship !== "self" && p.relationship !== "child" && (
        <Callout tone="info" className="mt-4">
          For another adult, make sure they agree to you keeping their records here.
        </Callout>
      )}
    </Modal>
  );
}

function InviteForm({ profileId, name, onClose }: { profileId: string; name: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Invite someone to ${name}’s profile`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={() => { grantAccess(profileId, email.trim(), role); toast("Invitation created"); onClose(); }}>
            Create invitation
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Their email address">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="What they can do">
          {(id) => (
            <Select id={id} value={role} onChange={(e) => setRole(e.target.value as "viewer" | "editor")}>
              <option value="viewer">View records and schedules</option>
              <option value="editor">View and edit (e.g. record doses)</option>
            </Select>
          )}
        </Field>
        <p className="text-sm text-muted">They’ll only see this profile. In demo mode no email is sent; live deployments send the invitation through the configured email provider.</p>
      </div>
    </Modal>
  );
}
