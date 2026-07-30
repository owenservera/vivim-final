; NSIS Installer Script for Vivim Desktop
; Requires: NSIS 3.10+
; Usage: makensis installer.nsi

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

; ─── Configuration ────────────────────────────────────────────────────────────
Name "Vivim Desktop"
OutFile "vivim-desktop-setup.exe"
InstallDir "$LOCALAPPDATA\Vivim"
InstallDirRegKey HKCU "Software\Vivim" "InstallDir"
RequestExecutionLevel user
Unicode True

; ─── Version Info ─────────────────────────────────────────────────────────────
VIProductVersion "0.1.0.0"
VIAddVersionKey "ProductName" "Vivim Desktop"
VIAddVersionKey "CompanyName" "Vivim"
VIAddVersionKey "FileDescription" "Vivim Desktop Installer"
VIAddVersionKey "FileVersion" "0.1.0.0"
VIAddVersionKey "ProductVersion" "0.1.0.0"

; ─── MUI Settings ────────────────────────────────────────────────────────────
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

; ─── Pages ────────────────────────────────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; ─── Languages ────────────────────────────────────────────────────────────────
!insertmacro MUI_LANGUAGE "English"

; ─── Installer Sections ───────────────────────────────────────────────────────
Section "Vivim Desktop" SecMain
  SetOutPath "$INSTDIR"
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"
  
  ; Install sidecar binary (UPX-compressed)
  File "..\..\src-tauri\binaries\vivim-server-x86_64-pc-windows-msvc.exe"
  Rename "$INSTDIR\vivim-server-x86_64-pc-windows-msvc.exe" "$INSTDIR\vivim-server.exe"
  
  ; Install frontend static files
  SetOutPath "$INSTDIR\frontend"
  File /r "..\..\frontend\out\*.*"
  
  ; Install launcher script
  SetOutPath "$INSTDIR"
  File "launch.bat"
  
  ; Create Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\Vivim"
  CreateShortCut "$SMPROGRAMS\Vivim\Vivim Desktop.lnk" "$INSTDIR\launch.bat" "" "$INSTDIR\vivim-server.exe"
  CreateShortCut "$SMPROGRAMS\Vivim\Uninstall.lnk" "$INSTDIR\uninstall.exe"
  
  ; Create Desktop shortcut
  CreateShortCut "$DESKTOP\Vivim Desktop.lnk" "$INSTDIR\launch.bat" "" "$INSTDIR\vivim-server.exe"
  
  ; Store installation folder
  WriteRegStr HKCU "Software\Vivim" "InstallDir" "$INSTDIR"
  
  ; Add to Programs and Features
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "DisplayName" "Vivim Desktop"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "DisplayVersion" "0.1.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "Publisher" "Vivim"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "NoRepair" 1
  
  ; Calculate and store size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "EstimatedSize" "$0"
SectionEnd

; ─── Uninstaller Section ──────────────────────────────────────────────────────
Section "Uninstall"
  ; Remove files
  Delete "$INSTDIR\vivim-server.exe"
  Delete "$INSTDIR\launch.bat"
  Delete "$INSTDIR\uninstall.exe"
  
  ; Remove frontend files
  RMDir /r "$INSTDIR\frontend"
  
  ; Remove installation directory
  RMDir "$INSTDIR"
  
  ; Remove Start Menu shortcuts
  Delete "$SMPROGRAMS\Vivim\Vivim Desktop.lnk"
  Delete "$SMPROGRAMS\Vivim\Uninstall.lnk"
  RMDir "$SMPROGRAMS\Vivim"
  
  ; Remove Desktop shortcut
  Delete "$DESKTOP\Vivim Desktop.lnk"
  
  ; Remove registry keys
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim"
  DeleteRegKey HKCU "Software\Vivim"
SectionEnd
