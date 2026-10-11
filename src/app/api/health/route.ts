import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { aiConfigured } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

/** Health check: reports which integrations are configured (never their values). */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    time: new Date().toISOString(),
    integrations: {
      database: isSupabaseConfigured,
      auth: isSupabaseConfigured,
      serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      ai: aiConfigured(),
      email: Boolean(process.env.RESEND_API_KEY),
      sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      cron: Boolean(process.env.CRON_SECRET),
    },
  });
}
