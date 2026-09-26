import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_URL_LENGTH = 2048;
const POWERSHELL_TIMEOUT_MS = 12_000;
const SCRIPT_TOKEN = "__URL_BASE64__";
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export interface NavigationReceipt {
  readonly host: string;
  readonly action: "navigated";
}

export interface PowerShellResult {
  readonly stdout: string;
  readonly stderr: string;
}

export type PowerShellInvoker = (script: string) => Promise<PowerShellResult>;

export function validateNavigationUrl(input: string): URL {
  if (input.length === 0 || input.length > MAX_URL_LENGTH) {
    throw new Error(`URL must contain 1 to ${MAX_URL_LENGTH} characters.`);
  }
  if (input !== input.trim() || /[\u0000-\u001f\u007f]/u.test(input)) {
    throw new Error("URL must not contain leading/trailing whitespace or control characters.");
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Provide a complete absolute URL, such as https://example.com.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are allowed.");
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error("URLs with embedded usernames or passwords are not allowed.");
  }
  if (url.href.length > MAX_URL_LENGTH) {
    throw new Error(`Normalized URL must be at most ${MAX_URL_LENGTH} characters.`);
  }

  return url;
}

export function renderNavigationScript(template: string, url: URL): string {
  const occurrences = template.split(SCRIPT_TOKEN).length - 1;
  if (occurrences !== 1) {
    throw new Error("Arc navigation script must contain exactly one URL placeholder.");
  }
  const encodedUrl = Buffer.from(url.href, "utf8").toString("base64");
  return template.replace(SCRIPT_TOKEN, encodedUrl);
}

export function extractPowerShellFailure(stderr: string, exitCode: number | null): string {
  const scriptFailure = stderr.match(/ARC_NAVIGATE_FAILED[^\r\n]*/u)?.[0];
  if (scriptFailure) return scriptFailure;

  const actionable = stderr.match(/(?:Exception|Error):?\s*([^\r\n]+)/i)?.[1]?.trim();
  return actionable || `Arc automation failed (PowerShell exit code ${String(exitCode)}).`;
}

export async function invokePowerShell(script: string): Promise<PowerShellResult> {
  const encodedCommand = Buffer.from(script, "utf16le").toString("base64");
  const executable = process.env.ARC_POWERSHELL ?? "powershell.exe";

  return await new Promise<PowerShellResult>((resolvePromise, rejectPromise) => {
    const child = spawn(
      executable,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encodedCommand],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        rejectPromise(new Error("Arc automation timed out while waiting for Windows PowerShell."));
      }
    }, POWERSHELL_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if ("code" in error && error.code === "ENOENT") {
        rejectPromise(new Error("Windows PowerShell was not found. Run this server from WSL2 with Windows interop enabled."));
        return;
      }
      rejectPromise(new Error(`Could not start Windows PowerShell: ${error.message}`));
    });
    child.once("close", (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (code !== 0) {
        rejectPromise(new Error(extractPowerShellFailure(result.stderr, code)));
        return;
      }
      resolvePromise(result);
    });
  });
}

export async function navigateArc(
  input: string,
  invoke: PowerShellInvoker = invokePowerShell,
): Promise<NavigationReceipt> {
  const url = validateNavigationUrl(input);
  const template = await readFile(resolve(PROJECT_ROOT, "execution/navigate_arc.ps1"), "utf8");
  const script = renderNavigationScript(template, url);
  const result = await invoke(script);

  if (!result.stdout.includes("ARC_NAVIGATE_OK")) {
    throw new Error("Windows PowerShell returned without confirming Arc received the navigation command.");
  }

  return { host: url.hostname, action: "navigated" };
}

export async function getArcStatus(invoke: PowerShellInvoker = invokePowerShell): Promise<number> {
  const template = await readFile(resolve(PROJECT_ROOT, "execution/status_arc.ps1"), "utf8");
  const result = await invoke(template);
  const count = result.stdout.match(/ARC_VISIBLE_WINDOWS=(\d+)/u)?.[1];
  if (count === undefined) {
    throw new Error("Arc status check returned no visible-window count.");
  }
  return Number.parseInt(count, 10);
}
