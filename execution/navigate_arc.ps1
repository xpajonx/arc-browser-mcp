$ErrorActionPreference = "Stop"
$stage = "decode_url"

try {
    $encodedTarget = "__URL_BASE64__"
    $targetUrl = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($encodedTarget))

    if ($targetUrl.Length -gt 2048 -or $targetUrl -match '[\x00-\x1f\x7f]') {
        throw "URL_INVALID"
    }

    $targetUri = $null
    if (-not [System.Uri]::TryCreate($targetUrl, [System.UriKind]::Absolute, [ref]$targetUri)) {
        throw "URL_INVALID"
    }
    if ($targetUri.Scheme -notin @("http", "https") -or $targetUri.UserInfo) {
        throw "URL_INVALID"
    }

    $stage = "resolve_arc"
    $arcPackage = Get-AppxPackage -Name "TheBrowserCompany.Arc" -ErrorAction SilentlyContinue |
        Where-Object { $_.Status -eq "Ok" } |
        Select-Object -First 1
    if (-not $arcPackage) {
        throw "ARC_PACKAGE_NOT_FOUND"
    }

    $arcWindows = @(Get-Process -Name "Arc" -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne 0 })
    if ($arcWindows.Count -eq 0) {
        throw "ARC_WINDOW_NOT_VISIBLE"
    }

    $stage = "activate_arc_uri"
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    [Windows.System.Launcher,Windows.System,ContentType=WindowsRuntime] | Out-Null
    [Windows.System.LauncherOptions,Windows.System,ContentType=WindowsRuntime] | Out-Null

    $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq "AsTask" -and
        $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } | Select-Object -First 1
    if (-not $asTaskGeneric) {
        throw "WINRT_AS_TASK_UNAVAILABLE"
    }

    function Await-WinRtOperation {
        param(
            [object]$Operation,
            [Type]$ResultType
        )

        $task = $asTaskGeneric.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
        if (-not $task.Wait(15000)) {
            throw "ARC_URI_ACTIVATION_TIMEOUT"
        }
        return $task.Result
    }

    $options = [Windows.System.LauncherOptions]::new()
    $options.TargetApplicationPackageFamilyName = $arcPackage.PackageFamilyName
    $launched = Await-WinRtOperation `
        ([Windows.System.Launcher]::LaunchUriAsync($targetUri, $options)) `
        ([bool])
    if (-not $launched) {
        throw "ARC_URI_ACTIVATION_REJECTED"
    }

    [Console]::Out.WriteLine("ARC_NAVIGATE_OK")
    exit 0
}
catch {
    [Console]::Error.WriteLine("ARC_NAVIGATE_FAILED stage=" + $stage + " type=" + $_.Exception.GetType().Name)
    exit 1
}
