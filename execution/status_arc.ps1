$ErrorActionPreference = "Stop"
$arcWindows = @(Get-Process -Name "Arc" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 })
if ($arcWindows.Count -eq 0) {
    [Console]::Error.WriteLine("No visible Arc Browser window found.")
    exit 2
}
[Console]::Out.WriteLine("ARC_VISIBLE_WINDOWS=$($arcWindows.Count)")
