# User guide

This guide installs the Arc Browser MCP server in OpenCode V2 on Windows with OpenCode running in WSL2.

## 1. Check Windows and WSL2

Open Arc in Windows. From WSL2, confirm Windows PowerShell interop works:

```bash
powershell.exe -NoProfile -NonInteractive -Command '$PSVersionTable.PSVersion'
```

Confirm the packaged Arc app is installed for the same Windows user who has Arc open:

```bash
powershell.exe -NoProfile -NonInteractive -Command 'Get-AppxPackage -Name TheBrowserCompany.Arc | Select-Object Name,PackageFamilyName,Status'
```

The navigation script resolves Arc's package family name at runtime. It will not use the default browser association.

## 2. Install the server

```bash
git clone https://github.com/xpajonx/arc-browser-mcp.git
cd arc-browser-mcp
npm ci
npm run build
```

Run the local checks before opening OpenCode:

```bash
npm test
npm run eval
```

These checks do not navigate the browser. To install the repository's pre-commit gate for future commits:

```bash
git config core.hooksPath .githooks
```

## 3. Connect OpenCode

The checkout includes a project-local `opencode.json`. Start OpenCode from the repository root:

```bash
opencode .
```

Check the server state:

```bash
opencode mcp list
```

To use the server from other projects, register it globally while in the repository root:

```bash
opencode mcp add arc-browser --global -- node "$(pwd)/dist/src/index.js"
opencode mcp list
```

The global registration stores an absolute path. If you move or delete the checkout, remove the global `arc-browser` entry or register the new path.

## 4. Navigate

Call `arc_browser_status` first. A normal response looks like:

```json
{"available":true,"visibleWindows":1}
```

Then call `arc_navigate` with an absolute URL:

```json
{"url":"https://example.com"}
```

The response includes the destination hostname and `action: "navigated"`. Arc may navigate its current tab or open another tab. This API confirms that Windows accepted the app activation; it does not inspect the page or confirm its load state.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Windows PowerShell was not found` | Run the PowerShell interop check above. Enable WSL Windows interop or set `ARC_POWERSHELL` to the Windows PowerShell executable visible from WSL. |
| Arc is not available | Open Arc and leave a window visible, then call `arc_browser_status` again. |
| `ARC_NAVIGATE_FAILED stage=resolve_arc` | Install or repair the packaged Arc app for the current Windows user. |
| `ARC_NAVIGATE_FAILED stage=activate_arc_uri` | Confirm Arc supports HTTP/HTTPS app activation, rebuild with `npm run build`, then retry. |
| OpenCode cannot start the server | Run `npm ci` and `npm run build` in this repository, then check `opencode mcp list`. |
| You moved the checkout | Update the global MCP registration to the new absolute path, or use the project-local config from the checkout root. |

The error marker omits the full URL. For further diagnosis, run `npm run test:live` while Arc is open. This intentionally navigates Arc to a temporary loopback page and can change the active tab.

## Privacy notes

The server sends the URL to Arc through the Windows packaged-app URI launcher. It does not read the browser profile or page. Arc handles the request with your normal profile, so the destination may receive cookies. Use only URLs you intend to open in your signed-in browser.
