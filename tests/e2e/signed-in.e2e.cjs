/**
 * End-to-end check of a real signed-in account against a local Supabase:
 * phone OTP sign-up, onboarding, upload, reload from the database, share link
 * (valid and tampered), sign-out, password sign-in, account deletion.
 *
 * Needs: `supabase start` with the migrations, a test OTP in supabase/config.toml
 *   [auth.sms.test_otp]
 *   919876543210 = "123456"
 * and the app built and running against it (see docs/TESTING.md).
 * Usage: BASE_URL=http://localhost:3000 node tests/e2e/signed-in.e2e.cjs <screenshot-dir>
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const OUT = process.argv[2] || ".";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const step = (m) => console.log("•", m);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, timezoneId: "Asia/Kolkata", locale: "en-IN" });
  const p = await ctx.newPage();
  globalThis.__p = p;
  const errors = [];
  p.on("pageerror", (e) => errors.push(p.url() + " " + e.message.slice(0, 40)));
  p.on("console", (m) => { if (m.type() === "error") errors.push(p.url() + " console: " + m.text().slice(0, 60)); });

  step("sign up with phone OTP");
  await p.goto(BASE + "/auth/sign-up", { waitUntil: "networkidle" });
  await p.getByLabel("Country").selectOption("IN");
  await p.getByLabel("Phone number").fill("98765 43210");
  await p.getByRole("button", { name: "Send verification code" }).click();
  await p.getByLabel("Verification code").fill("123456");
  await p.getByRole("button", { name: "Verify" }).click();
  await p.getByLabel("New password").fill("Calm-River-2026-quiet");
  await p.getByLabel("Confirm password").fill("Calm-River-2026-quiet");
  await p.getByRole("button", { name: "Save password and continue" }).click();
  await p.waitForURL("**/app/onboarding");
  await p.getByText("Welcome to HealthOS").waitFor();
  step("onboarding");
  await p.getByRole("button", { name: "Continue" }).click();
  await p.getByLabel("First name").fill("Priya");
  await p.getByRole("button", { name: "Skip setup" }).click();
  await p.waitForURL(BASE + "/app");
  await p.getByText("Good", { exact: false }).first().waitFor();
  await p.getByText("All changes saved").waitFor({ timeout: 15000 });
  await p.screenshot({ path: `${OUT}/01-dashboard-signed-in.png` });

  step("upload a lab report");
  await p.goto(BASE + "/app/documents/upload", { waitUntil: "networkidle" });
  const report = `Lab Report\nReport Date: 02-Oct-2026\nTest  Result  Unit  Reference Interval\nHemoglobin  13.1  g/dL  12.0 - 15.5\nTSH  5.8  H  mIU/L  0.4 - 4.0\nFerritin 45\n`;
  await p.setInputFiles('input[aria-label="Choose files to upload"]', { name: "thyroid-report.txt", mimeType: "text/plain", buffer: Buffer.from(report) });
  await p.getByRole("button", { name: /Save 1 file/ }).click();
  await p.waitForURL(/documents\/[0-9a-f-]{36}$/, { timeout: 30000 });
  await p.getByText("All changes saved").waitFor({ timeout: 15000 });
  const docUrl = p.url();
  await p.screenshot({ path: `${OUT}/02-report-saved.png`, fullPage: true });

  step("reload: data comes back from the database");
  await p.reload({ waitUntil: "networkidle" });
  await p.getByRole("heading", { name: /thyroid report/i }).waitFor({ timeout: 15000 });
  await p.goto(BASE + "/app/compare", { waitUntil: "networkidle" });
  await p.getByText("TSH").first().waitFor();

  step("create a share link and open it signed out");
  await p.goto(BASE + "/app/share", { waitUntil: "networkidle" });
  await p.locator('input[type="checkbox"]').first().check();
  await p.getByRole("button", { name: /Create link for 1 record/ }).click();
  const link = await p.getByLabel("Your new link").inputValue();
  await p.getByText("All changes saved").waitFor({ timeout: 15000 });
  const anon = await (await b.newContext()).newPage();
  await anon.goto(link, { waitUntil: "networkidle" });
  await anon.getByText(/thyroid report/i).first().waitFor({ timeout: 15000 });
  await anon.screenshot({ path: `${OUT}/03-shared-view.png`, fullPage: true });
  const bad = await (await b.newContext()).newPage();
  await bad.goto(link.slice(0, -2) + "xx", { waitUntil: "networkidle" });
  await bad.getByText("This link isn’t valid").waitFor({ timeout: 15000 });

  step("sign out, sign back in with password");
  await p.goto(BASE + "/app/privacy", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Sign out", exact: true }).click();
  await p.waitForURL(BASE + "/");
  await p.goto(BASE + "/auth/sign-in", { waitUntil: "networkidle" });
  await p.getByLabel("Country").selectOption("IN");
  await p.getByLabel("Phone number").fill("9876543210");
  await p.getByLabel("Password").fill("Calm-River-2026-quiet");
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.waitForURL(BASE + "/app");
  await p.goto(docUrl, { waitUntil: "networkidle" });
  await p.getByRole("heading", { name: /thyroid report/i }).waitFor({ timeout: 15000 });
  await p.goto(BASE + "/app/privacy", { waitUntil: "networkidle" });
  await p.screenshot({ path: `${OUT}/04-privacy-signed-in.png`, fullPage: true });
  step("delete the account");
  await p.getByRole("button", { name: "Delete my account and all my records" }).click();
  await p.getByRole("button", { name: "Delete everything" }).click();
  await p.waitForURL(BASE + "/", { timeout: 20000 });
  fs.writeFileSync(`${OUT}/state.json`, JSON.stringify({ docUrl, link }));
  console.log("errors:", errors);
  await b.close();
})().catch(async (e) => { console.error("FAILED:", e.message); try { await globalThis.__p.screenshot({ path: OUT + "/fail.png", fullPage: true }); console.log("url", globalThis.__p.url()); } catch {} process.exit(1); });
