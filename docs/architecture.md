# Architecture and scope

## Goal and outcome

The MCP server provides one visible behavior: an agent can ask the running Windows Arc Browser to navigate to an HTTP(S) URL. The gate is a successful MCP call that results in the URL being accepted by Arc; a local loopback-page smoke test verifies the browser actually requests the URL. The offline eval measures URL validation across 10 deterministic cases.

## Integration choice

Arc is running as a Windows Store app while this OpenCode process runs in WSL2. The observed Arc process has no remote-debugging flag, and loopback checks for common DevTools ports (9222, 9223, 9229, 9333) returned unavailable. CDP would require stopping and relaunching Arc with debugging enabled. Existing Arc MCP projects found during research target macOS or require that CDP relaunch.

This implementation invokes Windows PowerShell from WSL2 and calls `Windows.System.Launcher.LaunchUriAsync` with `LauncherOptions.TargetApplicationPackageFamilyName` set to Arc's installed package family name. Windows routes the URI to Arc even though Chrome is the default HTTP(S) handler. This works with the Arc process already open, does not send synthetic keystrokes, and requires no browser restart or extension install. The API's successful return confirms dispatch; it does not provide a page-load or DOM result.

Win32 `SendInput` was tested and removed: Windows reported keyboard events sent, but Arc's page did not navigate. Event acceptance is not evidence of browser navigation. The packaged-app route is verified with an MCP call plus a request received by a local loopback test page.

## Boundaries

- `src/` contains MCP registration, URL validation, and process invocation.
- `execution/` contains deterministic Windows-side scripts.
- The server does not read tabs, page text, cookies, browser history, or profile files.
- Only absolute HTTP and HTTPS URLs are accepted. Embedded credentials, control characters, and oversized URLs are rejected.
- Arc must be installed as the `TheBrowserCompany.Arc` packaged app and have a visible window. The script resolves the package family at runtime and fails closed if Arc is not open.
- Windows packaged-app activation may decide whether the URL opens in the current tab or another tab; the MCP contract promises navigation, not tab placement.
- The WinRT activation result is checked. A false result or timeout returns an MCP tool error rather than reporting a successful navigation.
- Navigation still uses the user's existing Arc profile. The destination receives normal browser requests and can see any cookies that Arc normally sends. The tool does not click page controls or submit forms.
- Structured audit lines go to stderr and include only event, result, host, action, and timestamp. URL paths and query strings are not logged or returned.

## Why not CDP or an extension

CDP offers precise tab targeting and DOM-level verification, but this live Arc process is not debuggable and enabling it requires a browser restart plus a sensitive remote-debugging endpoint. An extension bridge would require installation and broader permissions. Packaged-app URI activation reaches the requested Arc app directly while keeping the current Arc session running.
