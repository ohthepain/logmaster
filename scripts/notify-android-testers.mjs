import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export function notificationConfig(env) {
  const recipients = [
    ...new Set(
      (env.ANDROID_TESTER_EMAILS || "")
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map((value) => value.toLowerCase()),
    ),
  ];
  if (
    !recipients.length ||
    recipients.length > 100 ||
    recipients.some((value) => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value))
  ) {
    throw new Error("Set ANDROID_TESTER_EMAILS to 1–100 valid email addresses");
  }
  const version = env.ANDROID_RELEASE_LABEL?.trim();
  if (!version || !/^[A-Za-z0-9][A-Za-z0-9 .()+_-]{0,79}$/.test(version)) {
    throw new Error("Set a short ANDROID_RELEASE_LABEL, for example 1.0 (build 2)");
  }
  const link = env.ANDROID_TESTING_URL?.trim();
  const url = new URL(link || "https://invalid.example");
  if (
    url.origin !== "https://play.google.com" ||
    url.pathname !== "/apps/testing/live.logmaster.app" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Set ANDROID_TESTING_URL to the Play opt-in link for live.logmaster.app");
  }
  if (!["true", "false"].includes(env.NOTIFY_DRY_RUN || "true")) {
    throw new Error("NOTIFY_DRY_RUN must be true or false");
  }
  const dryRun = env.NOTIFY_DRY_RUN !== "false";
  if (!dryRun && env.ANDROID_RELEASE_AVAILABLE !== "true") {
    throw new Error("Confirm the release is available to internal testers before sending");
  }
  const from = env.AWS_SES_FROM_EMAIL?.trim();
  if (!from || /[\r\n]/.test(from)) throw new Error("Set AWS_SES_FROM_EMAIL to a verified SES sender");
  return {
    recipients,
    dryRun,
    from,
    subject: `Logmaster Android ${version} is ready to test`,
    text: `Hi Sailors,\n\nLogmaster Android ${version} is ready for internal testing.\n\nJoin the test and install or update the app:\n${link}\n\nUse the Google account registered in the Sailors tester list. On the page, join the test and follow the Google Play installation link.\n\nPlease reply with any bugs or feedback, including your Android model and what you were doing.\n\nThanks for testing Logmaster!`,
  };
}

export async function notifyTesters(config, send) {
  const result = { recipients: config.recipients.length, accepted: 0, failed: 0, dryRun: config.dryRun };
  if (config.dryRun) return result;
  for (const recipient of config.recipients) {
    try {
      await send({
        Source: config.from,
        Destination: { ToAddresses: [recipient] },
        Message: {
          Subject: { Data: config.subject, Charset: "UTF-8" },
          Body: { Text: { Data: config.text, Charset: "UTF-8" } },
        },
      });
      result.accepted++;
    } catch {
      result.failed++;
      // Do not print provider responses or private recipient addresses.
      console.error(`SES request failed for recipient ${result.accepted + result.failed}; delivery may be uncertain`);
    }
  }
  return result;
}

async function main() {
  const config = notificationConfig(process.env);
  console.info(config.subject + "\n\n" + config.text);
  // A failed request can have reached SES: never retry sends automatically.
  const client = new SESClient({ region: process.env.AWS_REGION || "eu-central-1", maxAttempts: 1 });
  const result = await notifyTesters(config, (message) => client.send(new SendEmailCommand(message)));
  const summary = `${result.dryRun ? "PREVIEW — no email sent" : "Send completed"}: ${result.recipients} recipients, ${result.accepted} accepted by SES, ${result.failed} failed or uncertain.\n`;
  console.info(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (result.failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    if (error instanceof Error && error.message) {
      console.error(error.message);
    } else {
      console.error("Notification failed: check required configuration and SES access.");
    }
    process.exitCode = 1;
  });
}
