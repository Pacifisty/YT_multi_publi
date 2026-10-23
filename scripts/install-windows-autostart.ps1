#Requires -RunAsAdministrator

$ErrorActionPreference = 'Stop'

$taskName = 'PMP API'
$startupScript = Join-Path $PSScriptRoot 'start-windows-api.ps1'
$powerShellExecutable = Join-Path $PSHOME 'powershell.exe'

if (-not (Test-Path -LiteralPath $startupScript)) {
    throw "Script de inicialização não encontrado: $startupScript"
}

$actionArguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$startupScript`""
$action = New-ScheduledTaskAction -Execute $powerShellExecutable -Argument $actionArguments -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description 'Inicia automaticamente a API da Plataforma Multi Publisher.' `
    -Force | Out-Null

# Replace the manually started Node instance that currently owns the API port.
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object {
        $process = Get-Process -Id $_ -ErrorAction SilentlyContinue
        if ($process -and $process.ProcessName -eq 'node') {
            Stop-Process -Id $process.Id -Force
        }
    }

Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 5

$task = Get-ScheduledTask -TaskName $taskName
$taskInfo = Get-ScheduledTaskInfo -TaskName $taskName

[pscustomobject]@{
    TaskName       = $task.TaskName
    State          = $task.State
    LastRunTime    = $taskInfo.LastRunTime
    LastTaskResult = $taskInfo.LastTaskResult
}
