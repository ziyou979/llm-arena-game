# 像素竞技场 skill 安装/更新（Windows PowerShell 5+ / PowerShell 7）
#   powershell -ExecutionPolicy Bypass -File install.ps1 http://<服务器>:8787
param([Parameter(Mandatory=$true)][string]$Server)
$ErrorActionPreference = 'Stop'
$B = $Server.TrimEnd('/')
$H = $env:USERPROFILE
$T = @()
if ($env:ARENA_SKILL_DIR) { $T += $env:ARENA_SKILL_DIR } else {
  if ((Test-Path "$H\.codex") -or (Test-Path "$H\.minimax") -or (Test-Path "$H\.agents")) { $T += "$H\.agents\skills\pixel-arena" }
  if (Test-Path "$H\.claude") { $T += "$H\.claude\skills\pixel-arena" }
  if (Test-Path "$H\.qoder") { $T += "$H\.qoder\skills\pixel-arena" }
  if ((Test-Path "$H\.gemini\config") -or (Test-Path "$H\.gemini\antigravity")) { $T += "$H\.gemini\config\skills\pixel-arena" }
  if (Test-Path "$H\.gemini\settings.json") { $T += "$H\.gemini\skills\pixel-arena" }
  if (Test-Path "$H\.workbuddy") { $T += "$H\.workbuddy\skills\pixel-arena" }
  if ($T.Count -eq 0) { $T += "$H\.agents\skills\pixel-arena" }
}
$mText = (Invoke-WebRequest -UseBasicParsing "$B/skill/manifest.json").Content
if ($mText -is [byte[]]) { $mText = [Text.Encoding]::UTF8.GetString($mText) }
$m = $mText | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path "$H\.pixel-arena" | Out-Null
$reg = "$H\.pixel-arena\installs.txt"; if (-not (Test-Path $reg)) { New-Item -ItemType File -Path $reg | Out-Null }
$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($dir in $T) {
  foreach ($f in $m.files) {
    $p = Join-Path $dir ($f.path -replace '/', '\')
    New-Item -ItemType Directory -Force -Path (Split-Path $p) | Out-Null
    Invoke-WebRequest -UseBasicParsing "$B/skill/file/$($f.path)" -OutFile $p
  }
  [IO.File]::WriteAllText((Join-Path $dir '.manifest.json'), $mText, $utf8)
  [IO.File]::WriteAllText((Join-Path $dir '.server'), $B, $utf8)
  if (-not ((Get-Content $reg) -contains $dir)) { Add-Content -Path $reg -Value $dir }
  Write-Host "已装到 $dir（版本 $($m.version)）"
}
Write-Host '以后每局开局，模型跑 arena.mjs update 会把上面所有位置一起同步。装完重启一下 AI 工具。'
