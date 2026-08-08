import { execFileSync } from 'node:child_process'

const ps = `Get-CimInstance Win32_Process -Filter "Name='opencode.exe'" | Where-Object { $_.CommandLine -match 'serve' } | ForEach-Object { $_.ProcessId.ToString() + ' | ' + $_.CommandLine }`
const out = execFileSync('powershell', ['-NoProfile', '-Command', ps]).toString().trim()
console.log('serve processes:')
console.log(out || '(none)')
