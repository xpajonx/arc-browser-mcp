import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  getArcStatus,
  navigateArc,
  extractPowerShellFailure,
  renderNavigationScript,
  validateNavigationUrl,
} from "../dist/src/navigation.js";

test("accepts and canonicalizes absolute HTTP and HTTPS URLs", () => {
  assert.equal(validateNavigationUrl("https://example.com/a path?q=a+b").href, "https://example.com/a%20path?q=a+b");
  assert.equal(validateNavigationUrl("http://127.0.0.1:43189/ready").hostname, "127.0.0.1");
  assert.equal(validateNavigationUrl("https://bücher.example/").hostname, "xn--bcher-kva.example");
});

test("rejects unsupported schemes, credentials, whitespace, controls, and oversized URLs", () => {
  for (const url of ["javascript:alert(1)", "file:///C:/Windows", "data:text/html,hi", "ftp://example.com"]) {
    assert.throws(() => validateNavigationUrl(url), /absolute URL|Only HTTP and HTTPS/u);
  }
  assert.throws(() => validateNavigationUrl("https://user:secret@example.com"), /usernames or passwords/u);
  assert.throws(() => validateNavigationUrl(" https://example.com"), /whitespace/u);
  assert.throws(() => validateNavigationUrl("https://example.com/\n"), /control characters/u);
  assert.throws(() => validateNavigationUrl(`https://example.com/${"a".repeat(2050)}`), /2048/u);
});

test("embeds URL as Base64 and escapes the script placeholder exactly once", async () => {
  const template = await readFile(new URL("../execution/navigate_arc.ps1", import.meta.url), "utf8");
  const url = validateNavigationUrl("https://example.com/search?q=a+b&ratio=100%25");
  const rendered = renderNavigationScript(template, url);
  const encoded = Buffer.from(url.href, "utf8").toString("base64");

  assert.ok(rendered.includes(`"${encoded}"`));
  assert.ok(!rendered.includes("__URL_BASE64__"));
  assert.ok(!rendered.includes(url.href));
  assert.match(rendered, /Get-AppxPackage -Name "TheBrowserCompany\.Arc"/u);
  assert.match(rendered, /TargetApplicationPackageFamilyName = \$arcPackage\.PackageFamilyName/u);
  assert.match(rendered, /LaunchUriAsync\(\$targetUri, \$options\)/u);
  assert.match(rendered, /ARC_URI_ACTIVATION_REJECTED/u);
  assert.match(rendered, /ParameterType\.Name -eq 'IAsyncOperation`1'/u);
  assert.doesNotMatch(rendered, /SendInput|SendWait/u);
  assert.throws(() => renderNavigationScript("no placeholder", url), /exactly one/u);
});

test("navigation uses injected PowerShell and reports only the destination host", async () => {
  let invokedScript = "";
  const receipt = await navigateArc("https://example.com/private/path?token=never-log", async (script) => {
    invokedScript = script;
    return { stdout: "ARC_NAVIGATE_OK\n", stderr: "" };
  });

  assert.deepEqual(receipt, { host: "example.com", action: "navigated" });
  assert.ok(!invokedScript.includes("private/path"));
});

test("navigation fails if PowerShell did not confirm dispatch", async () => {
  await assert.rejects(
    navigateArc("https://example.com", async () => ({ stdout: "", stderr: "" })),
    /without confirming/u,
  );
});

test("PowerShell errors prefer the bounded navigation failure marker over CLIXML noise", () => {
  const stderr = '#< CLIXML\r\nARC_NAVIGATE_FAILED stage=activate_arc_uri type=RuntimeException\r\n<Objs><Obj><AV>Preparing modules for first use.</AV></Obj></Objs>';
  assert.equal(
    extractPowerShellFailure(stderr, 1),
    "ARC_NAVIGATE_FAILED stage=activate_arc_uri type=RuntimeException",
  );
  assert.equal(extractPowerShellFailure("", 1), "Arc automation failed (PowerShell exit code 1).");
});

test("status reports visible window count from a bounded marker", async () => {
  assert.equal(await getArcStatus(async () => ({ stdout: "ARC_VISIBLE_WINDOWS=1\n", stderr: "" })), 1);
  await assert.rejects(getArcStatus(async () => ({ stdout: "", stderr: "" })), /no visible-window count/u);
});
