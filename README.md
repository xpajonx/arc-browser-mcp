# Arc Browser MCP

Local stdio MCP server for opening URLs in the currently running Windows Arc Browser from OpenCode in WSL2.

## Tools

- `arc_browser_status`: checks for a visible Arc window. It does not read tabs, titles, URLs, or page content.
- `arc_navigate`: navigates Arc to an absolute HTTP(S) URL through Windows packaged-app activation. Windows may choose the current tab or a new tab.

No CDP port, browser restart, extension, login token, or remote service is used.

## Install

Requirements: Windows Arc running in the logged-in desktop, WSL2 Windows interop enabled, Node.js 20+, and Windows PowerShell 5.1 available as `powershell.exe`.

From this directory:

```bash
npm install
npm run build
npm test
npm run eval
git config core.hooksPath .githooks
```

OpenCode's project config is in `opencode.json`. To register the server for all projects, run:

```bash
opencode mcp add arc-browser --global -- node /home/xpajonx/projects/arc-browser-mcp/dist/src/index.js
```

Check the connection with `opencode mcp list`. The server command is `npm start` from this project, or the absolute `node .../dist/src/index.js` command above.

## Use

Call `arc_browser_status` first, then `arc_navigate` with a URL such as `https://example.com`. Windows routes the URI to the Arc app package even if another browser is the default. Arc must be installed and have a visible window.

## Safety and limits

The server allows only HTTP(S), rejects URLs containing credentials, rejects control characters, and caps URL length at 2,048 characters. It reports only the destination hostname, never the path or query. It does not read page content, click, fill forms, or access cookies. Since navigation uses the existing Arc profile, the destination can receive cookies as it would during normal browsing.

If Arc is closed, open it and call `arc_browser_status` again. This implementation targets the current Windows/WSL2 setup; macOS and native Linux are not supported.

See [architecture notes](docs/architecture.md) for the transport choice and observed limitations.
