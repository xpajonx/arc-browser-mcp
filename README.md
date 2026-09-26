# Arc Browser MCP for OpenCode

[![CI](https://github.com/xpajonx/arc-browser-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/xpajonx/arc-browser-mcp/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A local stdio MCP server that lets OpenCode navigate the Arc Browser already running on Windows from WSL2. It targets Arc directly, even when another browser is the Windows default.

**Tools:** `arc_browser_status` checks for an open Arc window. `arc_navigate` opens an absolute HTTP(S) URL in Arc.

## Requirements

- Windows 10 or 11 with the packaged Arc Browser installed for the signed-in user
- WSL2 with Windows interop enabled
- Node.js 20 or newer and npm
- OpenCode V2
- Arc open with a visible window when the tools are called

This project does not use CDP, an extension, browser debugging ports, hosted APIs, or third-party browser services. It is not an npm-published package. Install it from this repository.

## Install

```bash
git clone https://github.com/xpajonx/arc-browser-mcp.git
cd arc-browser-mcp
npm ci
npm run build
npm test
npm run eval
git config core.hooksPath .githooks
```

OpenCode reads the project-local `opencode.json` when you start it from this checkout. Confirm the MCP server is connected:

```bash
opencode mcp list
```

To make the server available in every OpenCode project instead, register the absolute path from the checkout root:

```bash
opencode mcp add arc-browser --global -- node "$(pwd)/dist/src/index.js"
opencode mcp list
```

The global command writes to your OpenCode user config. The project-local config does not change global settings.

## Use

1. Open Arc in Windows and keep a window visible.
2. In OpenCode, call `arc_browser_status`. It should return `available: true`.
3. Call `arc_navigate` with a URL, for example `https://example.com`.

The tool reports the hostname and `action: "navigated"`. Windows may use the current tab or open another tab. The tool does not promise tab placement or confirm page rendering.

See the [step-by-step user guide](docs/guide.md) for setup details and troubleshooting. See [architecture notes](docs/architecture.md) for design and verification details.

## Security and privacy

- Only absolute HTTP and HTTPS URLs are accepted.
- URLs with credentials, control characters, or more than 2,048 characters are rejected.
- The MCP server does not read tab URLs, titles, page contents, cookies, browser history, or profile files.
- Navigation uses your existing Arc profile. The destination receives requests and cookies as it would during normal browsing.
- The structured audit line records only the hostname, action, result, and timestamp. It omits the URL path and query.
- A navigation can change the active browser page. Review the destination before calling the tool.

## Tests

```bash
npm test       # TypeScript build and local gate tests
npm run eval   # Offline URL-safety eval
```

The live smoke test makes Arc load a temporary local page and can change its current tab. Run it only when that is acceptable:

```bash
npm run test:live
```

The live test starts an HTTP server on loopback, calls the MCP tool, and passes only if Arc requests that local page. It makes no external network request. CI runs only the offline gate and eval.

## License

MIT. See [LICENSE](LICENSE).
