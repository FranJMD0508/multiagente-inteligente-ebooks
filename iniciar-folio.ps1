# Arranca Folio completo en Windows: el backend multiagente (FastAPI + LangGraph)
# y el frontend (Next.js) conectado a él, cada uno en su ventana.
#
#   .\iniciar-folio.ps1
#
# La primera vez crea el entorno de Python, instala las dependencias y copia los
# archivos de configuración de ejemplo. Para usar Gemini, pon tu clave en
# backend\.env (GEMINI_API_KEY=...); sin clave, Folio usa el proveedor "demo".

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$python = Join-Path $backend ".venv\Scripts\python.exe"

# ----- Backend -----
if (-not (Test-Path $python)) {
    Write-Host "Creando el entorno de Python del backend (solo la primera vez)..."
    Push-Location $backend
    python -m venv .venv
    & $python -m pip install --upgrade pip
    & $python -m pip install -r requirements.txt
    Pop-Location
}
$envFile = Join-Path $backend ".env"
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $backend ".env.example") $envFile
    Write-Host "Se creó backend\.env. Para usar Gemini, escribe tu clave en GEMINI_API_KEY."
}

# ----- Frontend -----
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    Write-Host "Instalando las dependencias del frontend (solo la primera vez)..."
    Push-Location $frontend
    npm install
    Pop-Location
}
$envLocal = Join-Path $frontend ".env.local"
if (-not (Test-Path $envLocal)) {
    Copy-Item (Join-Path $frontend ".env.example") $envLocal
    Write-Host "Se creó frontend\.env.local en modo backend (NEXT_PUBLIC_API_MODE=http)."
}

# ----- Arranque -----
Start-Process powershell -WorkingDirectory $backend -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'Folio · backend'; & '$python' -m app"
Start-Process powershell -WorkingDirectory $frontend -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'Folio · frontend'; npm run dev"

Write-Host "Esperando a que Folio esté listo..."
$ready = $false
for ($i = 0; $i -lt 90; $i++) {
    try {
        $api = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:8000/api/health"
        $web = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:3000"
        if ($api.StatusCode -eq 200 -and $web.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
}

if ($ready) {
    $health = (Invoke-WebRequest -UseBasicParsing "http://localhost:8000/api/health").Content | ConvertFrom-Json
    Write-Host "Folio está listo en http://localhost:3000 (agentes: $($health.provider) · $($health.model))."
    Start-Process "http://localhost:3000"
} else {
    Write-Host "Folio tarda más de lo normal en arrancar. Revisa las ventanas del backend y del frontend."
}
