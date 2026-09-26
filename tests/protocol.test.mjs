import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

test("stdio MCP handshake exposes Arc status and navigation tools", async () => {
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const client = new Client({ name: "arc-mcp-gate-test", version: "0.1.0" }, { capabilities: {} });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/src/index.js"],
    cwd: projectRoot,
    stderr: "pipe",
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    assert.ok(byName.has("arc_browser_status"));
    assert.ok(byName.has("arc_navigate"));
    assert.deepEqual(byName.get("arc_navigate")?.inputSchema.required, ["url"]);
    assert.equal(byName.get("arc_navigate")?.annotations?.readOnlyHint, false);

    const rejected = await client.callTool({ name: "arc_navigate", arguments: { url: "javascript:alert(1)" } });
    assert.equal(rejected.isError, true);
    assert.match(rejected.content[0]?.type === "text" ? rejected.content[0].text : "", /Only HTTP and HTTPS/u);
  } finally {
    await client.close();
  }
});
