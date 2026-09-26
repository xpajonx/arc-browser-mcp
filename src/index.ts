#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getArcStatus, navigateArc } from "./navigation.js";

const server = new McpServer({
  name: "arc-browser-mcp-server",
  version: "0.1.0",
});

server.registerTool(
  "arc_browser_status",
  {
    title: "Check Arc Browser",
    description: "Check whether a visible Windows Arc Browser window is available. Does not read tab titles, URLs, or page contents.",
    inputSchema: z.object({}).strict(),
    outputSchema: z.object({ available: z.boolean(), visibleWindows: z.number().int().nonnegative() }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    try {
      const visibleWindows = await getArcStatus();
      const output = { available: visibleWindows > 0, visibleWindows };
      return {
        content: [{ type: "text", text: `Arc is available (${visibleWindows} visible window${visibleWindows === 1 ? "" : "s"}).` }],
        structuredContent: output,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Arc status check failed.";
      return { isError: true, content: [{ type: "text", text: message }] };
    }
  },
);

server.registerTool(
  "arc_navigate",
  {
    title: "Navigate Arc",
    description: "Navigate the running Windows Arc Browser to an absolute HTTP(S) URL using Windows packaged-app URI activation. This may change Arc's current tab and uses the user's existing Arc profile. The tool does not read tabs, page content, cookies, or history.",
    inputSchema: z.object({
      url: z.string().min(1).max(2048).describe("Absolute HTTP(S) URL, for example https://example.com"),
    }).strict(),
    outputSchema: z.object({ host: z.string(), action: z.literal("navigated") }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async ({ url }) => {
    try {
      const output = await navigateArc(url);
      console.error(JSON.stringify({ event: "arc.navigate", result: "dispatched", host: output.host, action: output.action, at: new Date().toISOString() }));
      return {
        content: [{ type: "text", text: `Navigated Arc to ${output.host}.` }],
        structuredContent: { host: output.host, action: output.action },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Arc navigation failed.";
      console.error(JSON.stringify({ event: "arc.navigate", result: "failed", reason: message, at: new Date().toISOString() }));
      return { isError: true, content: [{ type: "text", text: message }] };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("arc-browser-mcp-server ready on stdio");
