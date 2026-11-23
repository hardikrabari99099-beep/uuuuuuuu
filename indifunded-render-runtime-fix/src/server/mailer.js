import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

export const EMAIL_PROVIDERS = {
  gmail: {
    id: "gmail",
    label: "Business Gmail / Google Workspace",
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
    smtp_secure: true,
  },
  titan: {
    id: "titan",
    label: "Titan Business Email",
    smtp_host: "smtp.titan.email",
    smtp_port: 465,
    smtp_secure: true,
  },
  custom: {
    id: "custom",
    label: "Custom SMTP",
    smtp_host: "",
    smtp_port: 465,
    smtp_secure: true,
  },
};

export const DEFAULT_EMAIL_CONFIG = {
  id: "email_config",
  provider: "gmail",
  smtp_host: "smtp.gmail.com",
  smtp_port: 465,
  smtp_secure: true,
  smtp_user: "",
  smtp_password: "",
  from_name: "IndiFunded",
  from_email: "",
  reply_to: "",
  welcome_enabled: true,
  welcome_subject: "Welcome to IndiFunded, {{name}}",
  welcome_body:
    "Hi {{name}},\n\nThanks for creating your IndiFunded account ({{email}}). Your account is active and ready to use.\n\nIf you ever need help, just reply directly to this email.\n\nBest regards,\nIndiFunded Team",
  login_welcome_enabled: true,
  login_welcome_subject: "New sign-in to your IndiFunded account",
  login_welcome_body:
    "Hi {{name}},\n\nYou signed in to your IndiFunded account ({{email}}) at {{login_time}}.\n\nIf this was you, no action is needed. If you did not sign in, please reset your password right away.\n\nBest regards,\nIndiFunded Team",
  updated_at: "",
};

function readLocalEnvFile() {
  const out = {};
  for (const filename of [".env", ".env.local"]) {
    try {
      const fullPath = path.resolve(process.cwd(), filename);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        out[key] = val;
      }
    } catch {
      // ignore unreadable local env files
    }
  }
  return out;
}

export function normalizeSmtpPassword(provider, password) {
  const raw = String(password || "");
  if (!raw) return "";
  // Google App Passwords are displayed as 4 groups of 4 chars separated by spaces.
  if (provider === "gmail") {
    return raw.replace(/\s+/g, "");
  }
  return raw;
}

export function resolveEmailConfig(stored) {
  const localEnv = readLocalEnvFile();
  const envUser = String(
    process.env["GMAIL_USER"] ||
      process.env["SMTP_USER"] ||
      localEnv["GMAIL_USER"] ||
      localEnv["SMTP_USER"] ||
      "",
  ).trim();
  const envPass = String(
    process.env["GMAIL_APP_PASSWORD"] ||
      process.env["SMTP_PASSWORD"] ||
      localEnv["GMAIL_APP_PASSWORD"] ||
      localEnv["SMTP_PASSWORD"] ||
      "",
  ).trim();
  const envHost = String(process.env["SMTP_HOST"] || localEnv["SMTP_HOST"] || "").trim();
  const envPort = Number(process.env["SMTP_PORT"] || localEnv["SMTP_PORT"] || 0);

  const envFallback =
    envUser || envPass || envHost
      ? {
          provider: envHost && envHost !== "smtp.gmail.com" ? "custom" : "gmail",
          smtp_host: envHost || "smtp.gmail.com",
          smtp_port: envPort || 465,
          smtp_secure: envPort ? envPort === 465 : true,
          smtp_user: envUser,
          smtp_password: normalizeSmtpPassword(
            envHost && envHost !== "smtp.gmail.com" ? "custom" : "gmail",
            envPass,
          ),
          from_email: envUser,
          reply_to: envUser,
        }
      : {};

  const cleanStored = {};
  if (stored && typeof stored === "object") {
    for (const [k, v] of Object.entries(stored)) {
      if (v !== undefined && v !== null && v !== "") cleanStored[k] = v;
      // Preserve explicit false booleans and explicit empty credential overrides
      if (typeof v === "boolean") cleanStored[k] = v;
      if ((k === "smtp_user" || k === "smtp_password") && v === "") cleanStored[k] = "";
    }
  }

  const merged = {
    ...DEFAULT_EMAIL_CONFIG,
    ...envFallback,
    ...cleanStored,
  };
  merged.provider = EMAIL_PROVIDERS[merged.provider] ? merged.provider : "gmail";
  merged.smtp_password = normalizeSmtpPassword(merged.provider, merged.smtp_password);
  if (!merged.from_email && merged.smtp_user) merged.from_email = merged.smtp_user;
  if (!merged.reply_to && merged.from_email) merged.reply_to = merged.from_email;
  return merged;
}

export function sanitizeEmailConfigForAdmin(cfg) {
  const merged = resolveEmailConfig(cfg);
  const hasPassword = Boolean(merged.smtp_password);
  const { smtp_password: _hidden, ...safe } = merged;
  return {
    ...safe,
    has_password: hasPassword,
    configured: Boolean(merged.smtp_host && merged.smtp_user && merged.smtp_password),
  };
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtmlEmail({ title, bodyLines, ctaLabel, ctaUrl }) {
  const paragraphs = bodyLines
    .filter((l) => l.trim().length > 0)
    .map(
      (l) =>
        `<p style="margin:0 0 14px 0;color:#1f2937;font-size:15px;line-height:1.6;">${escapeHtml(l)}</p>`,
    )
    .join("");
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<p style="margin:20px 0 14px 0;"><a href="${escapeHtml(ctaUrl)}" style="color:#1a7a4a;font-weight:600;text-decoration:underline;">${escapeHtml(ctaLabel)}</a></p>`
      : "";
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:20px 16px;background:#ffffff;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;">
    ${paragraphs}
    ${ctaBlock}
  </div>
</body>
</html>`;
}

function createTransporter(cfg) {
  const provider = EMAIL_PROVIDERS[cfg.provider] ? cfg.provider : "gmail";
  const preset = EMAIL_PROVIDERS[provider];
  const host = String(cfg.smtp_host || preset.smtp_host || "smtp.gmail.com").trim();
  const port = Number(cfg.smtp_port) || preset.smtp_port || 465;
  const secure = cfg.smtp_secure !== undefined ? Boolean(cfg.smtp_secure) : port === 465;
  const user = String(cfg.smtp_user || "").trim();
  const pass = normalizeSmtpPassword(provider, cfg.smtp_password);
  if (!host || !user || !pass) {
    throw new Error("Business Gmail / SMTP email and App Password must be saved before sending.");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 12000,
  });
}

function senderHeader(cfg) {
  const name = String(cfg.from_name || "IndiFunded").trim();
  const addr = String(cfg.from_email || cfg.smtp_user || "").trim();
  return name ? `"${name.replace(/"/g, "")}" <${addr}>` : addr;
}

export function renderEmailTemplate(template, vars) {
  return String(template || "")
    .replace(/\{\{name\}\}/g, vars.firstName || "Trader")
    .replace(/\{\{full_name\}\}/g, vars.fullName || vars.firstName || "Trader")
    .replace(/\{\{email\}\}/g, vars.email || "")
    .replace(/\{\{app_url\}\}/g, vars.appUrl || "")
    .replace(/\{\{login_time\}\}/g, vars.loginTime || "");
}

export function isEphemeralOrigin(origin) {
  const host = String(origin || "")
    .replace(/^https?:\/\//, "")
    .split("/")[0];
  return /(?:^|\.)(?:run\.app|localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(?::\d+)?$/i.test(host);
}

function assertAcceptedRecipient(info, recipient) {
  const accepted = Array.isArray(info?.accepted) ? info.accepted : [];
  const rejected = Array.isArray(info?.rejected) ? info.rejected : [];
  if (rejected.length > 0 || accepted.length === 0) {
    const target = rejected.length ? rejected.join(", ") : recipient;
    throw new Error(`Mail server rejected recipient (${target}).`);
  }
  return { accepted, rejected };
}

export function formatVars({ to, name, origin }) {
  const fullName = String(name || "Trader").trim() || "Trader";
  const firstName = fullName.split(/\s+/)[0] || "Trader";
  const cleanOrigin = origin ? origin.replace(/\/+$/, "") : "";
  const appUrl =
    cleanOrigin && !isEphemeralOrigin(cleanOrigin)
      ? cleanOrigin
      : "your IndiFunded Trader Dashboard";
  const loginTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return {
    firstName,
    fullName,
    email: String(to || "")
      .trim()
      .toLowerCase(),
    appUrl,
    loginTime,
    hasPublicUrl: Boolean(cleanOrigin && !isEphemeralOrigin(cleanOrigin)),
    publicOrigin: cleanOrigin && !isEphemeralOrigin(cleanOrigin) ? cleanOrigin : "",
  };
}

export async function sendWelcomeEmail({ to, name, config, origin }) {
  const cfg = resolveEmailConfig(config);
  const recipient = String(to || "")
    .trim()
    .toLowerCase();
  if (!cfg.welcome_enabled || !cfg.smtp_user || !cfg.smtp_password || !recipient) {
    return { sent: false, reason: "not_configured" };
  }
  const vars = formatVars({ to: recipient, name, origin });
  const subject = renderEmailTemplate(
    cfg.welcome_subject || DEFAULT_EMAIL_CONFIG.welcome_subject,
    vars,
  );
  const rawBody = renderEmailTemplate(cfg.welcome_body || DEFAULT_EMAIL_CONFIG.welcome_body, vars);
  try {
    const transporter = createTransporter(cfg);
    const dashUrl = vars.hasPublicUrl ? `${vars.publicOrigin}/challenges` : "";
    const html = buildHtmlEmail({
      title: `Welcome to IndiFunded, ${vars.firstName}`,
      bodyLines: rawBody.split(/\r?\n/),
      ctaLabel: dashUrl ? "Explore Challenge Plans" : "",
      ctaUrl: dashUrl,
    });
    const senderAddr = cfg.from_email || cfg.smtp_user;
    const replyToAddr = cfg.reply_to && cfg.reply_to !== senderAddr ? cfg.reply_to : undefined;
    const info = await transporter.sendMail({
      from: senderHeader(cfg),
      ...(replyToAddr ? { replyTo: replyToAddr } : {}),
      to: recipient,
      subject,
      text: rawBody,
      html,
    });
    const { accepted, rejected } = assertAcceptedRecipient(info, recipient);
    return {
      sent: true,
      messageId: info.messageId,
      accepted,
      rejected,
      response: info.response || "",
      from: senderAddr,
      subject,
      provider: cfg.provider,
    };
  } catch (err) {
    console.warn("[mailer] Welcome email skipped/failed:", err?.message || err);
    return {
      sent: false,
      reason: err?.message || "send_failed",
      from: cfg.from_email || cfg.smtp_user,
      subject,
      provider: cfg.provider,
    };
  }
}

export async function sendLoginWelcomeEmail({ to, name, config, origin }) {
  const cfg = resolveEmailConfig(config);
  const recipient = String(to || "")
    .trim()
    .toLowerCase();
  if (!cfg.login_welcome_enabled || !cfg.smtp_user || !cfg.smtp_password || !recipient) {
    return { sent: false, reason: "disabled_or_not_configured" };
  }
  const vars = formatVars({ to: recipient, name, origin });
  const subject = renderEmailTemplate(
    cfg.login_welcome_subject || DEFAULT_EMAIL_CONFIG.login_welcome_subject,
    vars,
  );
  const rawBody = renderEmailTemplate(
    cfg.login_welcome_body || DEFAULT_EMAIL_CONFIG.login_welcome_body,
    vars,
  );
  try {
    const transporter = createTransporter(cfg);
    const dashUrl = vars.hasPublicUrl ? `${vars.publicOrigin}/app` : "";
    const html = buildHtmlEmail({
      title: `Welcome back, ${vars.firstName}`,
      bodyLines: rawBody.split(/\r?\n/),
      ctaLabel: dashUrl ? "Open Trader Dashboard" : "",
      ctaUrl: dashUrl,
    });
    const senderAddr = cfg.from_email || cfg.smtp_user;
    const replyToAddr = cfg.reply_to && cfg.reply_to !== senderAddr ? cfg.reply_to : undefined;
    const info = await transporter.sendMail({
      from: senderHeader(cfg),
      ...(replyToAddr ? { replyTo: replyToAddr } : {}),
      to: recipient,
      subject,
      text: rawBody,
      html,
    });
    const { accepted, rejected } = assertAcceptedRecipient(info, recipient);
    return {
      sent: true,
      messageId: info.messageId,
      accepted,
      rejected,
      response: info.response || "",
      from: senderAddr,
      subject,
      provider: cfg.provider,
    };
  } catch (err) {
    console.warn("[mailer] Login welcome email skipped/failed:", err?.message || err);
    return {
      sent: false,
      reason: err?.message || "send_failed",
      from: cfg.from_email || cfg.smtp_user,
      subject,
      provider: cfg.provider,
    };
  }
}

export async function sendPasswordResetEmail({ to, resetUrl, config }) {
  const cfg = resolveEmailConfig(config);
  const recipient = String(to || "")
    .trim()
    .toLowerCase();
  if (!cfg.smtp_user || !cfg.smtp_password || !recipient || !resetUrl) {
    return { sent: false, reason: "not_configured" };
  }
  const transporter = createTransporter(cfg);
  const text = `Reset your IndiFunded password\n\nWe received a request to reset your password for ${recipient}.\nOpen this link to choose a new password:\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`;
  const html = buildHtmlEmail({
    title: "Reset your IndiFunded password",
    bodyLines: [
      `We received a request to reset the password for ${recipient}.`,
      "Click the button below to choose a new password for your IndiFunded account.",
      "If you did not request a password change, you can safely ignore this email.",
    ],
    ctaLabel: "Reset Password",
    ctaUrl: resetUrl,
  });
  const senderAddr = cfg.from_email || cfg.smtp_user;
  const replyToAddr = cfg.reply_to && cfg.reply_to !== senderAddr ? cfg.reply_to : undefined;
  const info = await transporter.sendMail({
    from: senderHeader(cfg),
    ...(replyToAddr ? { replyTo: replyToAddr } : {}),
    to: recipient,
    subject: "Reset your IndiFunded password",
    text,
    html,
  });
  assertAcceptedRecipient(info, recipient);
  return { sent: true, messageId: info.messageId, accepted: info.accepted };
}

export async function sendTestEmail({ to, name, config, origin, templateType = "test" }) {
  const cfg = resolveEmailConfig(config);
  const recipient = String(to || "")
    .trim()
    .toLowerCase();
  const transporter = createTransporter(cfg);
  try {
    await transporter.verify();
  } catch (err) {
    const raw = err?.message || "SMTP connection failed";
    if (
      cfg.provider === "gmail" &&
      /535|Username and Password not accepted|Invalid login/i.test(raw)
    ) {
      throw new Error(
        "Gmail rejected the credentials. Turn on 2-Step Verification in your Google Account and use a 16-character Google App Password (not your regular Gmail password).",
      );
    }
    throw err;
  }

  if (templateType === "welcome") {
    const res = await sendWelcomeEmail({
      to: recipient,
      name: name || recipient.split("@")[0],
      config: { ...cfg, welcome_enabled: true },
      origin,
    });
    if (!res.sent) throw new Error(res.reason || "Failed to send welcome test email");
    return res;
  }
  if (templateType === "login") {
    const res = await sendLoginWelcomeEmail({
      to: recipient,
      name: name || recipient.split("@")[0],
      config: { ...cfg, login_welcome_enabled: true },
      origin,
    });
    if (!res.sent) throw new Error(res.reason || "Failed to send login welcome test email");
    return res;
  }

  const providerLabel = EMAIL_PROVIDERS[cfg.provider]?.label || "Business Email";
  const cleanOrigin = origin && !isEphemeralOrigin(origin) ? origin.replace(/\/+$/, "") : "";
  const subject = `IndiFunded email setup verified`;
  const text = `Hi,\n\nYour ${providerLabel} address (${cfg.smtp_user}) is connected and ready to send welcome emails.\n\nBest regards,\nIndiFunded Team`;
  const html = buildHtmlEmail({
    title: subject,
    bodyLines: text.split(/\r?\n/),
    ctaLabel: cleanOrigin ? "Open Business Email Settings" : "",
    ctaUrl: cleanOrigin ? `${cleanOrigin}/admin/email` : "",
  });
  const info = await transporter.sendMail({
    from: senderHeader(cfg),
    replyTo: cfg.reply_to || cfg.from_email || cfg.smtp_user,
    to: recipient,
    subject,
    text,
    html,
  });
  const { accepted, rejected } = assertAcceptedRecipient(info, recipient);
  return {
    sent: true,
    messageId: info.messageId,
    accepted,
    rejected,
    response: info.response || "",
    from: cfg.from_email || cfg.smtp_user,
    subject,
    provider: cfg.provider,
  };
}

export async function sendAccountBreachEmail({ to, name, account, breach, config, origin }) {
  const cfg = resolveEmailConfig(config);
  const recipient = String(to || "")
    .trim()
    .toLowerCase();
  if (!cfg.smtp_user || !cfg.smtp_password || !recipient) {
    return { sent: false, reason: "not_configured" };
  }
  const vars = formatVars({ to: recipient, name, origin });
  const acctNo = account?.account_number || account?.id || "Account";
  const planName = account?.plan_name || "IndiFunded Account";
  const reason = breach?.reason || "Risk limit breached";
  const equityVal = `₹${Number(breach?.equity ?? account?.balance ?? 0).toLocaleString("en-IN")}`;
  const breachTime = breach?.breached_at || new Date().toISOString();

  const subject = `Account Failed — ${planName} (${acctNo})`;
  const text = [
    `Hi ${vars.firstName},`,
    "",
    `Your IndiFunded account ${acctNo} (${planName}) has automatically breached its risk limit and is now marked as FAILED.`,
    "",
    `Breach Reason: ${reason}`,
    `Breach Time: ${breachTime}`,
    `Equity at Breach: ${equityVal}`,
    "",
    "New trading orders on this account have been blocked, pending orders cancelled, and open positions closed per our automated risk policy.",
    "",
    "You can review full breach metrics and order history inside your IndiFunded Trader Dashboard.",
    "",
    "Best regards,",
    "IndiFunded Risk Desk",
  ].join("\n");

  const dashUrl = vars.hasPublicUrl ? `${vars.publicOrigin}/app/accounts` : "";
  try {
    const transporter = createTransporter(cfg);
    const html = buildHtmlEmail({
      title: subject,
      bodyLines: text.split(/\r?\n/),
      ctaLabel: dashUrl ? "View Account Details" : "",
      ctaUrl: dashUrl,
    });
    const senderAddr = cfg.from_email || cfg.smtp_user;
    const replyToAddr = cfg.reply_to && cfg.reply_to !== senderAddr ? cfg.reply_to : undefined;
    const info = await transporter.sendMail({
      from: senderHeader(cfg),
      ...(replyToAddr ? { replyTo: replyToAddr } : {}),
      to: recipient,
      subject,
      text,
      html,
    });
    const { accepted, rejected } = assertAcceptedRecipient(info, recipient);
    return {
      sent: true,
      messageId: info.messageId,
      accepted,
      rejected,
      response: info.response || "",
      from: senderAddr,
      subject,
      provider: cfg.provider,
    };
  } catch (err) {
    console.warn("[mailer] Breach email skipped/failed:", err?.message || err);
    return {
      sent: false,
      reason: err?.message || "send_failed",
      from: cfg.from_email || cfg.smtp_user,
      subject,
      provider: cfg.provider,
    };
  }
}

export async function sendChallengePassedEmail({
  to,
  name,
  challengeAccount,
  fundedAccount,
  config,
  origin,
}) {
  const cfg = resolveEmailConfig(config);
  const recipient = String(to || "")
    .trim()
    .toLowerCase();
  if (!cfg.smtp_user || !cfg.smtp_password || !recipient) {
    return { sent: false, reason: "not_configured" };
  }
  const vars = formatVars({ to: recipient, name, origin });
  const acctNo = challengeAccount?.account_number || challengeAccount?.id || "Challenge";
  const fundedNo = fundedAccount?.account_number || "";
  const planName = challengeAccount?.plan_name || "1-Step Challenge";

  const subject = `Challenge Passed — ${planName} (${acctNo})`;
  const text = [
    `Hi ${vars.firstName},`,
    "",
    `Congratulations! You have passed all rules and objectives for ${planName} (${acctNo}).`,
    fundedNo
      ? `Your funded account (${fundedNo}) has been automatically activated and is ready in your dashboard.`
      : "Your account is now marked as eligible for funded account activation.",
    "",
    "Best regards,",
    "IndiFunded Team",
  ].join("\n");

  const dashUrl = vars.hasPublicUrl ? `${vars.publicOrigin}/app/accounts` : "";
  try {
    const transporter = createTransporter(cfg);
    const html = buildHtmlEmail({
      title: subject,
      bodyLines: text.split(/\r?\n/),
      ctaLabel: dashUrl ? "Open Trader Dashboard" : "",
      ctaUrl: dashUrl,
    });
    const senderAddr = cfg.from_email || cfg.smtp_user;
    const replyToAddr = cfg.reply_to && cfg.reply_to !== senderAddr ? cfg.reply_to : undefined;
    const info = await transporter.sendMail({
      from: senderHeader(cfg),
      ...(replyToAddr ? { replyTo: replyToAddr } : {}),
      to: recipient,
      subject,
      text,
      html,
    });
    const { accepted, rejected } = assertAcceptedRecipient(info, recipient);
    return {
      sent: true,
      messageId: info.messageId,
      accepted,
      rejected,
      response: info.response || "",
      from: senderAddr,
      subject,
      provider: cfg.provider,
    };
  } catch (err) {
    console.warn("[mailer] Challenge passed email skipped/failed:", err?.message || err);
    return {
      sent: false,
      reason: err?.message || "send_failed",
      from: cfg.from_email || cfg.smtp_user,
      subject,
      provider: cfg.provider,
    };
  }
}
