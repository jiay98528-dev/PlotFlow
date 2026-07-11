!include LogicLib.nsh
!include FileFunc.nsh
!include nsDialogs.nsh
!include WinMessages.nsh

LangString PlotFlowAppRunningAbort 1033 "PlotFlow is currently running. Close PlotFlow, then run the installer or uninstaller again."
LangString PlotFlowAppRunningAbort 2052 "PlotFlow 正在运行。请先关闭 PlotFlow，然后重新运行安装器或卸载器。"
LangString PlotFlowAppRunningAbort 1028 "PlotFlow 正在執行。請先關閉 PlotFlow，然後重新執行安裝程式或解除安裝程式。"
LangString PlotFlowAppRunningAbort 1041 "PlotFlow が実行中です。PlotFlow を終了してから、インストーラーまたはアンインストーラーをもう一度実行してください。"
LangString PlotFlowAppRunningAbort 1042 "PlotFlow가 실행 중입니다. PlotFlow를 닫은 다음 설치 관리자 또는 제거 관리자를 다시 실행하세요."

LangString PlotFlowUninstallTitle 1033 "Remove PlotFlow"
LangString PlotFlowUninstallTitle 2052 "卸载 PlotFlow"
LangString PlotFlowUninstallTitle 1028 "解除安裝 PlotFlow"
LangString PlotFlowUninstallTitle 1041 "PlotFlow を削除"
LangString PlotFlowUninstallTitle 1042 "PlotFlow 제거"

LangString PlotFlowUninstallBody 1033 "Choose whether to also delete PlotFlow settings, caches, and local learning data for this Windows account. Your .mdstory files are never deleted."
LangString PlotFlowUninstallBody 2052 "选择是否同时删除此 Windows 账户下的 PlotFlow 设置、缓存和本地学习数据。用户创建的 .mdstory 文件不会被删除。"
LangString PlotFlowUninstallBody 1028 "選擇是否同時刪除此 Windows 帳戶下的 PlotFlow 設定、快取與本機學習資料。使用者建立的 .mdstory 檔案不會被刪除。"
LangString PlotFlowUninstallBody 1041 "この Windows アカウントの PlotFlow 設定、キャッシュ、ローカル学習データも削除するかを選択してください。作成した .mdstory ファイルは削除されません。"
LangString PlotFlowUninstallBody 1042 "이 Windows 계정의 PlotFlow 설정, 캐시 및 로컬 학습 데이터도 삭제할지 선택하세요. 사용자가 만든 .mdstory 파일은 삭제되지 않습니다."

LangString PlotFlowDeleteUserData 1033 "Also delete PlotFlow settings, caches, and local learning data"
LangString PlotFlowDeleteUserData 2052 "同时删除 PlotFlow 设置、缓存和本地学习数据"
LangString PlotFlowDeleteUserData 1028 "同時刪除 PlotFlow 設定、快取與本機學習資料"
LangString PlotFlowDeleteUserData 1041 "PlotFlow の設定、キャッシュ、ローカル学習データも削除する"
LangString PlotFlowDeleteUserData 1042 "PlotFlow 설정, 캐시 및 로컬 학습 데이터도 삭제"

LangString PlotFlowDeleteUserDataNote 1033 "Leave unchecked to keep preferences and local corpus data for a future reinstall."
LangString PlotFlowDeleteUserDataNote 2052 "保持未勾选会保留偏好设置和本地语料数据，方便以后重新安装。"
LangString PlotFlowDeleteUserDataNote 1028 "保持未勾選會保留偏好設定與本機語料資料，方便日後重新安裝。"
LangString PlotFlowDeleteUserDataNote 1041 "チェックしない場合、再インストール用に設定とローカルコーパスデータを保持します。"
LangString PlotFlowDeleteUserDataNote 1042 "선택하지 않으면 나중에 다시 설치할 수 있도록 환경 설정과 로컬 말뭉치 데이터를 유지합니다."

!macro customCheckAppRunning
  nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
  Pop $0
  ${If} $0 == 0
    MessageBox MB_ICONEXCLAMATION|MB_OK "$(PlotFlowAppRunningAbort)" /SD IDOK
    Quit
  ${EndIf}
!macroend

!macro customInstall
  WriteRegStr HKLM "Software\Classes\PlotFlow Story\shell\open\command" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\""
  System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend

!macro customUnWelcomePage
  UninstPage custom un.PlotFlowUninstallOptionsCreate un.PlotFlowUninstallOptionsLeave
!macroend

!macro customUnInstall
  ${GetParameters} $R0

  ClearErrors
  ${GetOptions} $R0 "/delete-app-data" $R1
  ${IfNot} ${Errors}
    StrCpy $PlotFlowDeleteUserDataFlag "1"
  ${EndIf}

  ClearErrors
  ${GetOptions} $R0 "--delete-app-data" $R1
  ${IfNot} ${Errors}
    StrCpy $PlotFlowDeleteUserDataFlag "1"
  ${EndIf}

  ${If} $PlotFlowDeleteUserDataFlag == "1"
    ${If} $installMode == "all"
      SetShellVarContext current
    ${EndIf}
    RMDir /r "$APPDATA\PlotFlow"
    RMDir /r "$LOCALAPPDATA\PlotFlow"
    RMDir /r "$LOCALAPPDATA\plotflow-updater"
    ${If} $installMode == "all"
      SetShellVarContext all
    ${EndIf}
  ${EndIf}

  ReadRegStr $R2 HKLM "Software\Classes\.mdstory" ""
  ${If} $R2 == "PlotFlow Story"
    DeleteRegKey HKLM "Software\Classes\.mdstory"
  ${EndIf}
  DeleteRegKey HKLM "Software\Classes\PlotFlow Story"

  ReadRegStr $R2 HKCU "Software\Classes\.mdstory" ""
  ${If} $R2 == "PlotFlow Story"
    DeleteRegKey HKCU "Software\Classes\.mdstory"
  ${EndIf}
  DeleteRegKey HKCU "Software\Classes\PlotFlow Story"
!macroend

!macro customUnInstallSection
  Section "-PlotFlowPostUninstallCleanup"
    SectionIn RO
    RMDir "$INSTDIR"
    System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
  SectionEnd
!macroend

!ifdef BUILD_UNINSTALLER
Var PlotFlowDeleteUserDataCheckbox
Var PlotFlowDeleteUserDataFlag

Function un.PlotFlowUninstallOptionsCreate
  StrCpy $PlotFlowDeleteUserDataFlag "0"

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 18u "$(PlotFlowUninstallTitle)"
  Pop $0
  CreateFont $1 "$(^Font)" 12 700
  SendMessage $0 ${WM_SETFONT} $1 1

  ${NSD_CreateLabel} 0 30u 100% 48u "$(PlotFlowUninstallBody)"
  Pop $0

  ${NSD_CreateCheckbox} 0 92u 100% 18u "$(PlotFlowDeleteUserData)"
  Pop $PlotFlowDeleteUserDataCheckbox
  ${NSD_Uncheck} $PlotFlowDeleteUserDataCheckbox

  ${NSD_CreateLabel} 0 120u 100% 30u "$(PlotFlowDeleteUserDataNote)"
  Pop $0

  nsDialogs::Show
FunctionEnd

Function un.PlotFlowUninstallOptionsLeave
  ${NSD_GetState} $PlotFlowDeleteUserDataCheckbox $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $PlotFlowDeleteUserDataFlag "1"
  ${Else}
    StrCpy $PlotFlowDeleteUserDataFlag "0"
  ${EndIf}
FunctionEnd
!endif
