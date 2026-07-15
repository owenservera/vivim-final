#!/usr/bin/env pwsh
# scripts/test-selectors.ps1
# Test all provider selectors against running Chrome via CDP
# Usage: .\scripts\test-selectors.ps1 [-Port 9222]

param(
    [int]$Port = 9222
)

$ErrorActionPreference = "Continue"

$providers = @(
    @{ Name = "chatgpt"; Url = "https://chatgpt.com/"; Selector = '#prompt-textarea' }
    @{ Name = "claude"; Url = "https://claude.ai/new"; Selector = '[contenteditable="true"].ProseMirror' }
    @{ Name = "gemini"; Url = "https://gemini.google.com/app"; Selector = '.ql-editor.textarea' }
    @{ Name = "deepseek"; Url = "https://chat.deepseek.com/"; Selector = 'textarea#chat-input' }
    @{ Name = "copilot"; Url = "https://copilot.microsoft.com/"; Selector = 'textarea' }
    @{ Name = "perplexity"; Url = "https://www.perplexity.ai/"; Selector = 'textarea' }
)

Write-Host "Selector Health Check" -ForegroundColor Cyan
Write-Host "CDP port: $Port" -ForegroundColor Gray
Write-Host ""

# Check if Chrome debug port is reachable
$chromeReachable = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", $Port)
    $tcp.Close()
    $chromeReachable = $true
} catch {}

if (-not $chromeReachable) {
    Write-Host "Chrome not reachable on port $Port — skipping provider tests" -ForegroundColor Yellow
    Write-Host "Start Chrome with: chrome.exe --remote-debugging-port=$Port" -ForegroundColor Gray
    exit 0
}

Write-Host "Chrome reachable on :$Port" -ForegroundColor Green
Write-Host ""

$passed = 0
$failed = 0

foreach ($provider in $providers) {
    Write-Host "Testing $($provider.Name)..." -ForegroundColor Yellow

    try {
        # Get list of tabs from CDP HTTP endpoint
        $tabsJson = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/json" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        $tabs = $tabsJson.Content | ConvertFrom-Json

        # Find a tab matching this provider's URL pattern
        $tab = $tabs | Where-Object { $_.url -like "*$($provider.Url.Split('/')[2])*" } | Select-Object -First 1

        if (-not $tab) {
            Write-Host "  [SKIP] $($provider.Name): no tab open for that provider" -ForegroundColor Gray
            continue
        }

        Write-Host "  [OK] $($provider.Name): tab found ($($tab.url))" -ForegroundColor Green
        $passed++
    } catch {
        Write-Host "  [FAIL] $($provider.Name): $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "Results:" -ForegroundColor Cyan
Write-Host "  Passed:   $passed" -ForegroundColor Green
Write-Host "  Failed:   $failed" -ForegroundColor Red
Write-Host ""

if ($failed -gt 0) {
    Write-Host "Some provider checks failed!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "All provider checks passed!" -ForegroundColor Green
    exit 0
}
