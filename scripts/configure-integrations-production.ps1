$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env'
$nodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Arquivo .env não encontrado em $projectRoot"
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
        throw "$prompt não pode ficar vazio."
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

Write-Host 'As credenciais digitadas não serão exibidas.' -ForegroundColor Cyan

$tiktokClientKey = Read-RequiredSecret 'TikTok Client Key'
$tiktokClientSecret = Read-RequiredSecret 'TikTok Client Secret'
$instagramClientId = Read-RequiredSecret 'Meta App ID / Instagram Client ID'
$instagramClientSecret = Read-RequiredSecret 'Meta App Secret / Instagram Client Secret'
$mercadoPagoAccessToken = Read-RequiredSecret 'Mercado Pago Access Token de produção (APP_USR-...)'
$mercadoPagoWebhookSecret = Read-RequiredSecret 'Mercado Pago assinatura secreta do Webhook'

try {
    if ($instagramClientId -notmatch '^\d+$') {
        throw 'O Meta App ID deve conter somente números.'
    }
    if (-not $mercadoPagoAccessToken.StartsWith('APP_USR-')) {
        throw 'Use o Access Token de produção do Mercado Pago, iniciado por APP_USR-.'
    }

    $values = @{
        TIKTOK_CLIENT_KEY          = $tiktokClientKey
        TIKTOK_CLIENT_SECRET       = $tiktokClientSecret
        TIKTOK_REDIRECT_URI        = 'https://plataformmultipublisher.com/api/accounts/oauth/tiktok/callback'
        INSTAGRAM_CLIENT_ID        = $instagramClientId
        INSTAGRAM_CLIENT_SECRET    = $instagramClientSecret
        INSTAGRAM_REDIRECT_URI     = 'https://plataformmultipublisher.com/api/accounts/oauth/instagram/callback'
        MERCADOPAGO_ACCESS_TOKEN   = $mercadoPagoAccessToken
        MERCADOPAGO_WEBHOOK_SECRET = $mercadoPagoWebhookSecret
        PAYMENT_SUCCESS_URL        = 'https://plataformmultipublisher.com/workspace/planos?payment=success'
        PAYMENT_CANCEL_URL         = 'https://plataformmultipublisher.com/workspace/planos?payment=cancel'
        PAYMENT_WEBHOOK_URL        = 'https://plataformmultipublisher.com/api/account/payments/webhook'
        AUTH_GOOGLE_ONLY           = 'true'
        EMAIL_PROVIDER             = 'disabled'
    }
    Set-EnvValues $values

    Push-Location $projectRoot
    try {
        & $nodeExecutable '--env-file-if-exists=.env' 'scripts/check-production-readiness.cjs'
        if ($LASTEXITCODE -ne 0) {
            throw 'A validação de produção encontrou pendências. NODE_ENV não foi alterado.'
        }
    } finally {
        Pop-Location
    }

    Set-EnvValues @{ NODE_ENV = 'production'; HOST = '127.0.0.1' }
    Write-Host 'Integrações gravadas e configuração de produção validada.' -ForegroundColor Green
    Write-Host 'Agora reinicie a tarefa PMP API para carregar as novas credenciais.'
} finally {
    $tiktokClientKey = $null
    $tiktokClientSecret = $null
    $instagramClientId = $null
    $instagramClientSecret = $null
    $mercadoPagoAccessToken = $null
    $mercadoPagoWebhookSecret = $null
}
