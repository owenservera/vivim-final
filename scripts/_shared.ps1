function Resolve-Bun {
  $candidates = @(
    (Get-Command bun -ErrorAction SilentlyContinue).Source,
    "$env:LOCALAPPDATA\bun\bin\bun.exe",
    "$env:USERPROFILE\.bun\bin\bun.exe",
    "$env:ProgramFiles\Bun\bin\bun.exe"
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  throw "bun executable not found. Install: https://bun.sh"
}
