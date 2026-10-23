$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $projectRoot '.runtime'
$logFile = Join-Path $runtimeDirectory 'api-service.log'

New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null

try {
    Set-Location -LiteralPath $projectRoot

    $wingetNodePattern = 'C:\Users\canab\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-*-win-x64\node.exe'
    $wingetNodes = Get-ChildItem -Path $wingetNodePattern -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -ExpandProperty FullName

    $nodeCandidates = @($wingetNodes) + @((Join-Path $env:ProgramFiles 'nodejs\node.exe'))
    $nodeExecutable = $nodeCandidates |
        Where-Object { $_ -and (Test-Path -LiteralPath $_) } |
        Select-Object -First 1

    if (-not $nodeExecutable) {
        throw 'Node.js não foi encontrado. Reinstale o Node.js LTS ou ajuste start-windows-api.ps1.'
    }

    "[$(Get-Date -Format o)] Iniciando API com $nodeExecutable" | Out-File -FilePath $logFile -Append -Encoding utf8

    # Rebuild generated frontend assets before each boot so the served files match the source.
    # Native applications may use stderr for non-fatal warnings. Check their exit
    # codes explicitly instead of letting PowerShell turn those warnings into errors.
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'

    & $nodeExecutable 'scripts/build-frontend-assets.mjs' *>> $logFile
    if ($LASTEXITCODE -ne 0) {
        $ErrorActionPreference = $previousErrorActionPreference
        throw "Falha ao gerar os assets do frontend (código $LASTEXITCODE)."
    }

    & $nodeExecutable '--env-file-if-exists=.env' '--import' 'tsx' 'apps/api/src/cli.ts' *>> $logFile
    $apiExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    "[$(Get-Date -Format o)] API encerrada com código $apiExitCode" | Out-File -FilePath $logFile -Append -Encoding utf8
    exit $apiExitCode
} catch {
    "[$(Get-Date -Format o)] ERRO: $($_.Exception.Message)" | Out-File -FilePath $logFile -Append -Encoding utf8
    $_ | Format-List * -Force | Out-File -FilePath $logFile -Append -Encoding utf8
    exit 1
}
