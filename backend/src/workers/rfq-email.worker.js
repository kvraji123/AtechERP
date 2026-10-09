import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { claimPendingEmail, markEmailFailed, markEmailSent, recoverStaleEmailClaims } from "../modules/rfq/rfq-email-outbox.service.js";

const configured = () => Boolean(env.smtp.host && env.smtp.user && env.smtp.password && env.smtp.fromEmail);
let running = false;
let timer = null;

function transporter() {
  return nodemailer.createTransport({ host: env.smtp.host, port: env.smtp.port, secure: env.smtp.secure, auth: { user: env.smtp.user, pass: env.smtp.password } });
}

export async function processRfqEmailOutbox(limit = 10) {
  if (!env.smtp.deliveryEnabled) return { processed: 0, disabled: true };
  if (!configured() || running) return { processed: 0, disabled: !configured() };
  running = true;
  let processed = 0;
  try {
    await recoverStaleEmailClaims();
    const mailer = transporter();
    while (processed < limit) {
      const email = await claimPendingEmail();
      if (!email) break;
      try {
        const result = await mailer.sendMail({ from: { name: env.smtp.fromName, address: env.smtp.fromEmail }, to: { name: email.recipient_name || undefined, address: email.recipient_email }, subject: email.subject, text: email.text_body, html: email.html_body });
        await markEmailSent(email.email_outbox_id, result.messageId);
      } catch (error) {
        await markEmailFailed(email.email_outbox_id, error?.message || error);
      }
      processed += 1;
    }
  } finally { running = false; }
  return { processed, disabled: false };
}

export function startRfqEmailWorker() {
  if (!env.smtp.deliveryEnabled) return;
  if (!configured()) { console.warn("RFQ SMTP worker disabled: configure SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD and SMTP_FROM_EMAIL to enable delivery."); return; }
  if (timer) return;
  const run = () => { void processRfqEmailOutbox().catch((error) => console.error("RFQ SMTP worker error:", error)); };
  run();
  timer = setInterval(run, env.smtp.pollIntervalMs);
  timer.unref?.();
}
