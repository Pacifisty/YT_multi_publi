$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env'

if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Arquivo .env nao encontrado em $projectRoot"
}

function ConvertFrom-SecureValue([Security.SecureString]$secureValue) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try {
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Read-RequiredSecret([string]$prompt) {
    $secureValue = Read-Host $prompt -AsSecureString
    $plainValue = ConvertFrom-SecureValue $secureValue
    if ([string]::IsNullOrWhiteSpace($plainValue)) {
        throw "$prompt nao pode ficar vazio."
    }
    return $plainValue.Trim()
}

function Set-EnvValues([hashtable]$values) {
    $lines = [Collections.Generic.List[string]]::new()
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

    foreach ($line in [IO.File]::ReadAllLines($envFile)) {
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=') {
            $name = $matches[1]
            if ($values.ContainsKey($name)) {
                $lines.Add("$name=$($values[$name])")
                $seen.Add($name) | Out-Null
                continue
            }
        }
        $lines.Add($line)
    }

    foreach ($name in $values.Keys) {
        if (-not $seen.Contains($name)) {
            $lines.Add("$name=$($values[$name])")
        }
    }

    [IO.File]::WriteAllLines($envFile, $lines, [Text.UTF8Encoding]::new($false))
}

Write-Host 'Use as credenciais da configuracao Sandbox do TikTok. Elas nao serao exibidas.' -ForegroundColor Cyan
$clientKey = Read-RequiredSecret 'TikTok Sandbox Client Key'
$clientSecret = Read-RequiredSecret 'TikTok Sandbox Client Secret'

try {
    Set-EnvValues @{
        TIKTOK_CLIENT_KEY    = $clientKey
        TIKTOK_CLIENT_SECRET = $clientSecret
        TIKTOK_REDIRECT_URI  = 'https://plataformmultipublisher.com/api/accounts/oauth/tiktok/callback'
        TIKTOK_SANDBOX       = 'true'
        PUBLIC_APP_URL       = 'https://plataformmultipublisher.com'
    }

    Write-Host 'TikTok Sandbox configurado. Reinicie a tarefa PMP API.' -ForegroundColor Green
    Write-Host 'Depois, conecte a conta-teste pelo botao Conectar TikTok.'
} finally {
    $clientKey = $null
    $clientSecret = $null
}
