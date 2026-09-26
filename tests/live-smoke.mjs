import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requestPath = `/arc-mcp-live-smoke/${randomUUID()}`;
let requestObserved = false;
let resolveRequest;
const requestReceived = new Promise((resolvePromise) => {
  resolveRequest = resolvePromise;
});

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === requestPath) {
    requestObserved = true;
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>Arc MCP smoke test</title><h1>Arc MCP smoke test passed</h1>");
    resolveRequest();
    return;
  }

  response.writeHead(404);
  response.end();
});

await new Promise((resolvePromise, rejectPromise) => {
  server.once("error", rejectPromise);
  server.listen(0, "127.0.0.1", resolvePromise);
});

const address = server.address();
assert.ok(address && typeof address !== "string", "Expected an ephemeral TCP port.");
const url = `http://127.0.0.1:${address.port}${requestPath}`;
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/src/index.js"],
  cwd: projectRoot,
  stderr: "pipe",
});
const client = new Client({ name: "arc-live-smoke", version: "0.1.0" }, { capabilities: {} });

try {
  await client.connect(transport);
  const status = await client.callTool({ name: "arc_browser_status", arguments: {} });
  assert.equal(status.isError, undefined, "Arc status tool returned an error.");
  assert.equal(status.structuredContent?.available, true, "Open Arc and keep a window visible first.");

  const navigation = await client.callTool({ name: "arc_navigate", arguments: { url } });
  assert.equal(navigation.isError, undefined, "Arc navigation tool returned an error.");

  let timeoutHandle;
  try {
    await Promise.race([
      requestReceived,
      new Promise((_, rejectPromise) => {
        timeoutHandle = setTimeout(
          () => rejectPromise(new Error("Arc did not request the loopback page within 12 seconds.")),
          12_000,
        );
      }),
    ]);
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }

  assert.equal(requestObserved, true);
  console.log("Live Arc smoke passed: Arc requested the temporary loopback page.");
} finally {
  await client.close().catch(() => {});
  server.closeAllConnections();
  await new Promise((resolvePromise) => server.close(resolvePromise));
}
