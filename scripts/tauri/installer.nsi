; ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
; Vivim Desktop — NSIS Installer
; Requires: NSIS 3.10+
; Usage: makensis installer.nsi
;
; Installation Flow:
;   Welcome → License → Components (providers) → Directory → Install → Finish
;
; Registers in Windows Settings → Apps → Installed Apps (Add/Remove Programs)
; ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

; ─── Configuration ────────────────────────────────────────────────────────────
Name "Vivim Desktop"
OutFile "vivim-desktop-setup.exe"
InstallDir "$LOCALAPPDATA\Vivim"
InstallDirRegKey HKCU "Software\Vivim" "InstallDir"
RequestExecutionLevel user
Unicode True
SetCompressor /SOLID lzma

; ─── Version Info ─────────────────────────────────────────────────────────────
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "Vivim Desktop"
VIAddVersionKey "CompanyName" "Vivim"
VIAddVersionKey "FileDescription" "Vivim Desktop Installer"
VIAddVersionKey "FileVersion" "1.0.0.0"
VIAddVersionKey "ProductVersion" "1.0.0.0"
VIAddVersionKey "LegalCopyright" "Copyright (c) 2026 Vivim"
VIAddVersionKey "LegalTrademarks" "MIT License"

; ─── Branding ─────────────────────────────────────────────────────────────────
!define MUI_ICON "..\..\src-tauri\icons\icon.ico"
!define MUI_UNICON "..\..\src-tauri\icons\icon.ico"
!define MUI_ABORTWARNING

; ─── Welcome Page ─────────────────────────────────────────────────────────────
!define MUI_WELCOMEPAGE_TITLE "Welcome to Vivim Desktop Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of Vivim Desktop.$\r$\n$\r$\nVivim is a local-first AI conversation platform that connects to multiple AI providers through your browser.$\r$\n$\r$\nClick Next to continue."

; ─── Finish Page ──────────────────────────────────────────────────────────────
!define MUI_FINISHPAGE_TITLE "Installation Complete"
!define MUI_FINISHPAGE_TEXT "Vivim Desktop has been installed on your computer.$\r$\n$\r$\nClick Finish to close this wizard."
!define MUI_FINISHPAGE_RUN "$INSTDIR\launch.bat"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Vivim Desktop"
!define MUI_FINISHPAGE_LINK "Visit Vivim on GitHub"
!define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/owenservera/vivim-final"

; ─── Pages ────────────────────────────────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; ─── Uninstaller Pages ────────────────────────────────────────────────────────
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; ─── Languages ────────────────────────────────────────────────────────────────
!insertmacro MUI_LANGUAGE "English"

; ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
; Provider selection variables
; ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Var CheckboxChatGPT
Var CheckboxClaude
Var CheckboxGemini
Var CheckboxDeepSeek
Var CheckboxQwen
Var CheckboxGrok
Var CheckboxOpenRouter
Var CheckboxOpenAIApi
Var CheckboxAnthropicApi

Var StateChatGPT
Var StateClaude
Var StateGemini
Var StateDeepSeek
Var StateQwen
Var StateGrok
Var StateOpenRouter
Var StateOpenAIApi
Var StateAnthropicApi

; ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
; Custom Provider Selection Page
; ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Function SelectProvidersPage
  nsDialogs::Create 1018
  Pop $0

  ${If} $0 == error
    Abort
  ${EndIf}

  ; Title
  ${NSD_CreateLabel} 0 0 100% 20u "Select the AI providers you want to enable:"
  Pop $0
  CreateFont $0 "Segoe UI" 10 700
  SendMessage $0 ${WM_SETFONT} $0 0

  ; Description
  ${NSD_CreateLabel} 0 22u 100% 16u "You can enable more providers later from within the app. Browser-based providers require a Chrome profile login."
  Pop $0

  ; ── Browser-Based Providers ─────────────────────────────────────────────────
  ${NSD_CreateLabel} 0 44u 100% 14u "Browser-Based (free, uses your existing accounts):"
  Pop $0
  CreateFont $0 "Segoe UI" 9 700
  SendMessage $0 ${WM_SETFONT} $0 0

  ${NSD_CreateCheckbox} 12u 60u 80u 14u "ChatGPT (chatgpt.com)"
  Pop $CheckboxChatGPT
  ${NSD_Check} $CheckboxChatGPT

  ${NSD_CreateCheckbox} 12u 76u 80u 14u "Claude (claude.ai)"
  Pop $CheckboxClaude
  ${NSD_Check} $CheckboxClaude

  ${NSD_CreateCheckbox} 12u 92u 80u 14u "Gemini (gemini.google.com)"
  Pop $CheckboxGemini
  ${NSD_Check} $CheckboxGemini

  ${NSD_CreateCheckbox} 12u 108u 80u 14u "DeepSeek (chat.deepseek.com)"
  Pop $CheckboxDeepSeek

  ${NSD_CreateCheckbox} 12u 124u 80u 14u "Qwen (tongyi.aliyun.com)"
  Pop $CheckboxQwen

  ${NSD_CreateCheckbox} 12u 140u 80u 14u "Grok (grok.com)"
  Pop $CheckboxGrok

  ; ── API-Based Providers ─────────────────────────────────────────────────────
  ${NSD_CreateLabel} 0 162u 100% 14u "API-Based (requires API key):"
  Pop $0
  CreateFont $0 "Segoe UI" 9 700
  SendMessage $0 ${WM_SETFONT} $0 0

  ${NSD_CreateCheckbox} 12u 178u 80u 14u "OpenRouter (multi-model)"
  Pop $CheckboxOpenRouter

  ${NSD_CreateCheckbox} 12u 194u 80u 14u "OpenAI API"
  Pop $CheckboxOpenAIApi

  ${NSD_CreateCheckbox} 12u 210u 80u 14u "Anthropic API"
  Pop $CheckboxAnthropicApi

  ; ── Select All / None ───────────────────────────────────────────────────────
  ${NSD_CreateButton} 320u 44u 60u 16u "Select All"
  Pop $0
  ${NSD_OnClick} $0 SelectAllProviders

  ${NSD_CreateButton} 384u 44u 60u 16u "Select None"
  Pop $0
  ${NSD_OnClick} $0 SelectNoProviders

  nsDialogs::Show
FunctionEnd

Function SelectAllProviders
  ${NSD_Check} $CheckboxChatGPT
  ${NSD_Check} $CheckboxClaude
  ${NSD_Check} $CheckboxGemini
  ${NSD_Check} $CheckboxDeepSeek
  ${NSD_Check} $CheckboxQwen
  ${NSD_Check} $CheckboxGrok
  ${NSD_Check} $CheckboxOpenRouter
  ${NSD_Check} $CheckboxOpenAIApi
  ${NSD_Check} $CheckboxAnthropicApi
FunctionEnd

Function SelectNoProviders
  ${NSD_Uncheck} $CheckboxChatGPT
  ${NSD_Uncheck} $CheckboxClaude
  ${NSD_Uncheck} $CheckboxGemini
  ${NSD_Uncheck} $CheckboxDeepSeek
  ${NSD_Uncheck} $CheckboxQwen
  ${NSD_Uncheck} $CheckboxGrok
  ${NSD_Uncheck} $CheckboxOpenRouter
  ${NSD_Uncheck} $CheckboxOpenAIApi
  ${NSD_Uncheck} $CheckboxAnthropicApi
FunctionEnd

Function SelectProvidersPageLeave
  ${NSD_GetState} $CheckboxChatGPT $StateChatGPT
  ${NSD_GetState} $CheckboxClaude $StateClaude
  ${NSD_GetState} $CheckboxGemini $StateGemini
  ${NSD_GetState} $CheckboxDeepSeek $StateDeepSeek
  ${NSD_GetState} $CheckboxQwen $StateQwen
  ${NSD_GetState} $CheckboxGrok $StateGrok
  ${NSD_GetState} $CheckboxOpenRouter $StateOpenRouter
  ${NSD_GetState} $CheckboxOpenAIApi $StateOpenAIApi
  ${NSD_GetState} $CheckboxAnthropicApi $StateAnthropicApi
FunctionEnd

; ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
; Custom page insertion
; ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Page custom SelectProvidersPage SelectProvidersPageLeave "Provider Selection"

; ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
; Sections
; ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

; ── Section: Core (always installed) ──────────────────────────────────────────
Section "Vivim Core (required)" SecCore
  SectionIn RO

  SetOutPath "$INSTDIR"

  ; Install sidecar binary
  File "..\..\src-tauri\binaries\vivim-server-x86_64-pc-windows-msvc.exe"
  Rename "$INSTDIR\vivim-server-x86_64-pc-windows-msvc.exe" "$INSTDIR\vivim-server.exe"

  ; Install launcher
  File "launch.bat"

  ; Install frontend static files
  SetOutPath "$INSTDIR\frontend"
  File /r "..\..\frontend\out\*.*"

  SetOutPath "$INSTDIR"

  ; Create config directory
  CreateDirectory "$INSTDIR\config"

  ; Write provider selection config
  FileOpen $0 "$INSTDIR\config\providers.json" w
  FileWrite $0 '{$\r$\n'
  FileWrite $0 '  "providers": {$\r$\n'

  ; ChatGPT
  FileWrite $0 '    "chatgpt": {$\r$\n'
  FileWrite $0 '      "enabled": '
  ${If} $StateChatGPT == ${BST_CHECKED}
    FileWrite $0 'true'
  ${Else}
    FileWrite $0 'false'
  ${EndIf}
  FileWrite $0 '$\r$\n'
  FileWrite $0 '    },$\r$\n'

  ; Claude
  FileWrite $0 '    "claude": {$\r$\n'
  FileWrite $0 '      "enabled": '
  ${If} $StateClaude == ${BST_CHECKED}
    FileWrite $0 'true'
  ${Else}
    FileWrite $0 'false'
  ${EndIf}
  FileWrite $0 '$\r$\n'
  FileWrite $0 '    },$\r$\n'

  ; Gemini
  FileWrite $0 '    "gemini": {$\r$\n'
  FileWrite $0 '      "enabled": '
  ${If} $StateGemini == ${BST_CHECKED}
    FileWrite $0 'true'
  ${Else}
    FileWrite $0 'false'
  ${EndIf}
  FileWrite $0 '$\r$\n'
  FileWrite $0 '    },$\r$\n'

  ; DeepSeek
  FileWrite $0 '    "deepseek": {$\r$\n'
  FileWrite $0 '      "enabled": '
  ${If} $StateDeepSeek == ${BST_CHECKED}
    FileWrite $0 'true'
  ${Else}
    FileWrite $0 'false'
  ${EndIf}
  FileWrite $0 '$\r$\n'
  FileWrite $0 '    },$\r$\n'

  ; Qwen
  FileWrite $0 '    "qwen": {$\r$\n'
  FileWrite $0 '      "enabled": '
  ${If} $StateQwen == ${BST_CHECKED}
    FileWrite $0 'true'
  ${Else}
    FileWrite $0 'false'
  ${EndIf}
  FileWrite $0 '$\r$\n'
  FileWrite $0 '    },$\r$\n'

  ; Grok
  FileWrite $0 '    "grok": {$\r$\n'
  FileWrite $0 '      "enabled": '
  ${If} $StateGrok == ${BST_CHECKED}
    FileWrite $0 'true'
  ${Else}
    FileWrite $0 'false'
  ${EndIf}
  FileWrite $0 '$\r$\n'
  FileWrite $0 '    },$\r$\n'

  ; OpenRouter
  FileWrite $0 '    "openrouter": {$\r$\n'
  FileWrite $0 '      "enabled": '
  ${If} $StateOpenRouter == ${BST_CHECKED}
    FileWrite $0 'true'
  ${Else}
    FileWrite $0 'false'
  ${EndIf}
  FileWrite $0 '$\r$\n'
  FileWrite $0 '    },$\r$\n'

  ; OpenAI API
  FileWrite $0 '    "openai_api": {$\r$\n'
  FileWrite $0 '      "enabled": '
  ${If} $StateOpenAIApi == ${BST_CHECKED}
    FileWrite $0 'true'
  ${Else}
    FileWrite $0 'false'
  ${EndIf}
  FileWrite $0 '$\r$\n'
  FileWrite $0 '    },$\r$\n'

  ; Anthropic API
  FileWrite $0 '    "anthropic_api": {$\r$\n'
  FileWrite $0 '      "enabled": '
  ${If} $StateAnthropicApi == ${BST_CHECKED}
    FileWrite $0 'true'
  ${Else}
    FileWrite $0 'false'
  ${EndIf}
  FileWrite $0 '$\r$\n'
  FileWrite $0 '    }$\r$\n'

  FileWrite $0 '  },$\r$\n'
  FileWrite $0 '  "installedAt": '
  FileWrite $0 '"1.0.0"$\r$\n'
  FileWrite $0 '}$\r$\n'
  FileClose $0

  ; Create Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\Vivim"
  CreateShortCut "$SMPROGRAMS\Vivim\Vivim Desktop.lnk" "$INSTDIR\launch.bat" "" "$INSTDIR\vivim-server.exe"
  CreateShortCut "$SMPROGRAMS\Vivim\Uninstall.lnk" "$INSTDIR\uninstall.exe"

  ; Create Desktop shortcut
  CreateShortCut "$DESKTOP\Vivim Desktop.lnk" "$INSTDIR\launch.bat" "" "$INSTDIR\vivim-server.exe"

  ; Store installation folder
  WriteRegStr HKCU "Software\Vivim" "InstallDir" "$INSTDIR"

  ; ── Add/Remove Programs registration ────────────────────────────────────────
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "DisplayName" "Vivim Desktop"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "DisplayIcon" "$\"$INSTDIR\vivim-server.exe$\""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "Publisher" "Vivim"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "URLInfoAbout" "https://github.com/owenservera/vivim-final"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "HelpLink" "https://github.com/owenservera/vivim-final/issues"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "NoRepair" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Vivim" \
    "EstimatedSize" 47000

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

; ── Descriptions ──────────────────────────────────────────────────────────────
LangString DESC_Core ${LANG_ENGLISH} "Vivim Desktop core files and runtime (required)"

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecCore} $(DESC_Core)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
; Uninstaller
; ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Section "Uninstall"
  ; Remove installed files
  Delete "$INSTDIR\vivim-server.exe"
  Delete "$INSTDIR\launch.bat"
  Delete "$INSTDIR\uninstall.exe"
  Delete "$INSTDIR\config\providers.json"

  ; Remove directories
  RMDir /r "$INSTDIR\frontend"
  RMDir /r "$INSTDIR\config"
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
