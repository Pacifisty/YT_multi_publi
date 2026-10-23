$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env'

if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Arquivo .env não encontrado em $projectRoot"
}

$adminEmail = (Read-Host 'E-mail administrativo real').Trim()
if ($adminEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$' -or $adminEmail.EndsWith('@example.com')) {
    throw 'Informe um endereço de e-mail administrativo válido.'
}

$password = Read-Host 'Crie uma senha administrativa com pelo menos 12 caracteres' -AsSecureString
$passwordConfirmation = Read-Host 'Repita a senha administrativa' -AsSecureString

function ConvertFrom-SecureValue([Security.SecureString]$secureValue) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try {
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

$plainPassword = ConvertFrom-SecureValue $password
$plainConfirmation = ConvertFrom-SecureValue $passwordConfirmation

try {
    if ($plainPassword.Length -lt 12) {
        throw 'A senha deve possuir pelo menos 12 caracteres.'
    }
    if ($plainPassword -cne $plainConfirmation) {
        throw 'As senhas digitadas não coincidem.'
    }

    $nodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source
    $env:ADMIN_PASSWORD = $plainPassword
    $passwordHash = (& $nodeExecutable (Join-Path $PSScriptRoot 'hash-admin-password.cjs')).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $passwordHash.StartsWith('scrypt:')) {
        throw 'Não foi possível gerar o hash seguro da senha administrativa.'
    }
} finally {
    Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
    $plainPassword = $null
    $plainConfirmation = $null
}

$oauthKeyBytes = New-Object byte[] 32
$randomNumberGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
$randomNumberGenerator.GetBytes($oauthKeyBytes)
$randomNumberGenerator.Dispose()
$oauthTokenKey = [Convert]::ToBase64String($oauthKeyBytes)
[Array]::Clear($oauthKeyBytes, 0, $oauthKeyBytes.Length)

$values = @{
    ADMIN_EMAIL        = $adminEmail
    ADMIN_PASSWORD_HASH = $passwordHash
    OAUTH_TOKEN_KEY     = $oauthTokenKey
}

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

Write-Host 'Credenciais centrais configuradas com sucesso.' -ForegroundColor Green
Write-Host 'A senha não foi salva; somente o hash seguro foi gravado.'
Write-Host 'Guarde uma cópia segura do arquivo .env, pois a chave OAuth é necessária para descriptografar tokens conectados.'
