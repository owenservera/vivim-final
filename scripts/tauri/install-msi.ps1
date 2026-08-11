param(
  [string]$MsiPath,
  [string]$LogPath
)
Start-Process msiexec.exe -ArgumentList "/i `"$MsiPath`" /qn /norestart /l*v `"$LogPath`"" -Verb RunAs -Wait
