"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useWorkspace } from "@/lib/hooks";
import { cloudClient } from "@/lib/cloud/sync";
import { Button, Card, CardHeader, toast } from "./ui";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

type PushState = "unsupported" | "off" | "on" | "blocked" | "working";

/** Turns reminder notifications on or off for this device (signed-in accounts). */
export function PushCard() {
  const ws = useWorkspace();
  const [st, setSt] = useState<PushState>("working");
  const cloud = ws?.state.mode === "cloud";

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setSt("unsupported");
    if (Notification.permission === "denied") return setSt("blocked");
    navigator.serviceWorker
      .getRegistration()
      .then((r) => r?.pushManager.getSubscription())
      .then((sub) => setSt(sub ? "on" : "off"))
      .catch(() => setSt("off"));
  }, []);

  async function turnOn() {
    setSt("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setSt(perm === "denied" ? "blocked" : "off");
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) }));
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { error } = (await cloudClient()?.from("push_subscriptions").upsert({ user_id: ws!.state.userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: "endpoint" })) ?? { error: new Error("offline") };
      if (error) throw error;
      setSt("on");
      toast("Notifications are on for this device");
    } catch {
      setSt("off");
      toast("Notifications couldn’t be turned on. Reminders still show in the app.", "danger");
    }
  }

  async function turnOff() {
    setSt("working");
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (sub) {
      await cloudClient()?.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe().catch(() => undefined);
    }
    setSt("off");
    toast("Notifications are off for this device");
  }

  let body: React.ReactNode;
  if (!cloud) body = <p>Device notifications need an account, because reminders are sent from the server. In the demo, due doses show on the Today and Medicines pages.</p>;
  else if (!VAPID) body = <p>Device notifications aren’t set up on this deployment yet. Email and SMS reminders can still be used if configured.</p>;
  else if (st === "unsupported") body = <p>This browser doesn’t support notifications. On iPhone or iPad, add HealthOS to your Home Screen first (Share → Add to Home Screen), then open it from there.</p>;
  else if (st === "blocked") body = <p>Notifications are blocked for this site in your browser settings. Allow them there, then come back.</p>;
  else
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{st === "on" ? "This device will get a notification when a dose is due." : "Get a notification on this device when a dose is due. The message never includes medicine names."}</p>
        {st === "on" ? (
          <Button size="sm" variant="secondary" onClick={turnOff}>
            Turn off
          </Button>
        ) : (
          <Button size="sm" onClick={turnOn} disabled={st === "working"}>
            Turn on for this device
          </Button>
        )}
      </div>
    );

  return (
    <Card>
      <CardHeader title="Notifications on this device" icon={<BellRing className="h-5 w-5" />} />
      <div className="p-5 text-sm text-ink-2">{body}</div>
    </Card>
  );
}
