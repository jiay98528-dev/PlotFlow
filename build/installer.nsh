!include LogicLib.nsh
!include FileFunc.nsh
!include nsDialogs.nsh
!include WinMessages.nsh

!define FABLEVIA_PRODUCT_GUID "74fc8b73-b58d-5573-82e7-75efc9ec526f"
!define FABLEVIA_PROGID "Fablevia.Story"

LangString FableviaAppRunningAbort 1033 "Fablevia is currently running. Close Fablevia, then run the installer or uninstaller again."
LangString FableviaAppRunningAbort 2052 "维叙（Fablevia）正在运行。请先关闭维叙（Fablevia），然后重新运行安装器或卸载器。"
LangString FableviaAppRunningAbort 1028 "維敘（Fablevia）正在執行。請先關閉維敘（Fablevia），然後重新執行安裝程式或解除安裝程式。"
LangString FableviaAppRunningAbort 1041 "Fablevia が実行中です。Fablevia を終了してから、インストーラーまたはアンインストーラーをもう一度実行してください。"
LangString FableviaAppRunningAbort 1042 "Fablevia가 실행 중입니다. Fablevia를 닫은 다음 설치 관리자 또는 제거 관리자를 다시 실행하세요."

LangString FableviaUninstallTitle 1033 "Remove Fablevia"
LangString FableviaUninstallTitle 2052 "卸载维叙（Fablevia）"
LangString FableviaUninstallTitle 1028 "解除安裝維敘（Fablevia）"
LangString FableviaUninstallTitle 1041 "Fablevia を削除"
LangString FableviaUninstallTitle 1042 "Fablevia 제거"

LangString FableviaUninstallBody 1033 "Choose whether to also delete Fablevia settings, caches, and local learning data for this Windows account. Your .mdstory files are never deleted."
LangString FableviaUninstallBody 2052 "选择是否同时删除此 Windows 账户下的维叙（Fablevia）设置、缓存和本地学习数据。用户创建的 .mdstory 文件不会被删除。"
LangString FableviaUninstallBody 1028 "選擇是否同時刪除此 Windows 帳戶下的維敘（Fablevia）設定、快取與本機學習資料。使用者建立的 .mdstory 檔案不會被刪除。"
LangString FableviaUninstallBody 1041 "この Windows アカウントの Fablevia 設定、キャッシュ、ローカル学習データも削除するかを選択してください。作成した .mdstory ファイルは削除されません。"
LangString FableviaUninstallBody 1042 "이 Windows 계정의 Fablevia 설정, 캐시 및 로컬 학습 데이터도 삭제할지 선택하세요. 사용자가 만든 .mdstory 파일은 삭제되지 않습니다."

LangString FableviaDeleteUserData 1033 "Also delete Fablevia settings, caches, and local learning data"
LangString FableviaDeleteUserData 2052 "同时删除维叙（Fablevia）设置、缓存和本地学习数据"
LangString FableviaDeleteUserData 1028 "同時刪除維敘（Fablevia）設定、快取與本機學習資料"
LangString FableviaDeleteUserData 1041 "Fablevia の設定、キャッシュ、ローカル学習データも削除する"
LangString FableviaDeleteUserData 1042 "Fablevia 설정, 캐시 및 로컬 학습 데이터도 삭제"

LangString FableviaDeleteUserDataNote 1033 "Leave unchecked to keep preferences and local corpus data for a future reinstall."
LangString FableviaDeleteUserDataNote 2052 "保持未勾选会保留偏好设置和本地语料数据，方便以后重新安装。"
LangString FableviaDeleteUserDataNote 1028 "保持未勾選會保留偏好設定與本機語料資料，方便日後重新安裝。"
LangString FableviaDeleteUserDataNote 1041 "チェックしない場合、再インストール用に設定とローカルコーパスデータを保持します。"
LangString FableviaDeleteUserDataNote 1042 "선택하지 않으면 나중에 다시 설치할 수 있도록 환경 설정과 로컬 말뭉치 데이터를 유지합니다."

!macro RemoveOwnedAssociation ROOT CLASS EXECUTABLE
  ReadRegStr $R2 ${ROOT} "Software\Classes\${CLASS}\shell\open\command" ""
  ${If} $R2 == "$\"$INSTDIR\${EXECUTABLE}$\" $\"%1$\""
    DeleteRegKey ${ROOT} "Software\Classes\${CLASS}"
  ${EndIf}
!macroend

!macro customCheckAppRunning
  nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
  Pop $0
  ${If} $0 != 0
    nsProcess::_FindProcess "PlotFlow.exe" ; brand-compat: block upgrade while the pre-Fablevia executable is running
    Pop $0
  ${EndIf}
  ${If} $0 == 0
    MessageBox MB_ICONEXCLAMATION|MB_OK "$(FableviaAppRunningAbort)" /SD IDOK
    Quit
  ${EndIf}
!macroend

!macro customInstall
  ; Keep the original product GUID, but replace only legacy registrations that
  ; are provably owned by the same installation directory.
  ReadRegStr $R3 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${FABLEVIA_PRODUCT_GUID}" "InstallLocation"
  ${If} $R3 == "$INSTDIR"
    Delete "$INSTDIR\PlotFlow.exe" ; brand-compat: remove the executable from the pre-Fablevia release
    Delete "$DESKTOP\PlotFlow.lnk" ; brand-compat: remove the pre-Fablevia desktop shortcut
    Delete "$SMPROGRAMS\PlotFlow.lnk" ; brand-compat: remove the pre-Fablevia Start Menu shortcut
    !insertmacro RemoveOwnedAssociation HKLM "PlotFlow Story" "PlotFlow.exe" ; brand-compat: legacy electron-builder ProgID
    !insertmacro RemoveOwnedAssociation HKLM "PlotFlow.Story" "PlotFlow.exe" ; brand-compat: legacy manual ProgID
    !insertmacro RemoveOwnedAssociation HKLM "Applications\PlotFlow.exe" "PlotFlow.exe" ; brand-compat: remove only a legacy registration bound to this install
  ${EndIf}

  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${FABLEVIA_PRODUCT_GUID}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Classes\.mdstory" "" "${FABLEVIA_PROGID}"
  WriteRegStr HKLM "Software\Classes\${FABLEVIA_PROGID}" "" "Fablevia Story"
  WriteRegStr HKLM "Software\Classes\${FABLEVIA_PROGID}" "FriendlyTypeName" "Fablevia Story"
  WriteRegStr HKLM "Software\Classes\${FABLEVIA_PROGID}\DefaultIcon" "" "$INSTDIR\file-icon.ico,0"
  WriteRegStr HKLM "Software\Classes\${FABLEVIA_PROGID}\shell\open\command" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\""
  System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend

!macro customUnWelcomePage
  UninstPage custom un.FableviaUninstallOptionsCreate un.FableviaUninstallOptionsLeave
!macroend

!macro customUnInstall
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/delete-app-data" $R1
  ${IfNot} ${Errors}
    StrCpy $FableviaDeleteUserDataFlag "1"
  ${EndIf}
  ClearErrors
  ${GetOptions} $R0 "--delete-app-data" $R1
  ${IfNot} ${Errors}
    StrCpy $FableviaDeleteUserDataFlag "1"
  ${EndIf}

  ${If} $FableviaDeleteUserDataFlag == "1"
    ${If} $installMode == "all"
      SetShellVarContext current
    ${EndIf}
    ; brand-compat: Fablevia intentionally keeps using the legacy PlotFlow directories so an
    ; in-place brand upgrade preserves existing user data.
    RMDir /r "$APPDATA\PlotFlow" ; brand-compat: Fablevia deliberately reuses the legacy profile
    RMDir /r "$LOCALAPPDATA\PlotFlow" ; brand-compat: clean the legacy cache only when explicitly requested
    RMDir /r "$LOCALAPPDATA\plotflow-updater"
    ${If} $installMode == "all"
      SetShellVarContext all
    ${EndIf}
  ${EndIf}

  ReadRegStr $R2 HKLM "Software\Classes\.mdstory" ""
  ${If} $R2 == "${FABLEVIA_PROGID}"
    DeleteRegKey HKLM "Software\Classes\.mdstory"
  ${EndIf}
  !insertmacro RemoveOwnedAssociation HKLM "${FABLEVIA_PROGID}" "${APP_EXECUTABLE_FILENAME}"
  !insertmacro RemoveOwnedAssociation HKLM "PlotFlow Story" "PlotFlow.exe" ; brand-compat: clean only an owned legacy association
  !insertmacro RemoveOwnedAssociation HKLM "PlotFlow.Story" "PlotFlow.exe" ; brand-compat: clean only an owned legacy association

  ReadRegStr $R2 HKCU "Software\Classes\.mdstory" ""
  ${If} $R2 == "${FABLEVIA_PROGID}"
    DeleteRegKey HKCU "Software\Classes\.mdstory"
  ${EndIf}
  !insertmacro RemoveOwnedAssociation HKCU "${FABLEVIA_PROGID}" "${APP_EXECUTABLE_FILENAME}"
  !insertmacro RemoveOwnedAssociation HKCU "PlotFlow Story" "PlotFlow.exe" ; brand-compat: clean only an owned legacy association
  !insertmacro RemoveOwnedAssociation HKCU "PlotFlow.Story" "PlotFlow.exe" ; brand-compat: clean only an owned legacy association
!macroend

!macro customUnInstallSection
  Section "-FableviaPostUninstallCleanup"
    SectionIn RO
    RMDir "$INSTDIR"
    System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
  SectionEnd
!macroend

!ifdef BUILD_UNINSTALLER
Var FableviaDeleteUserDataCheckbox
Var FableviaDeleteUserDataFlag

Function un.FableviaUninstallOptionsCreate
  StrCpy $FableviaDeleteUserDataFlag "0"
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 18u "$(FableviaUninstallTitle)"
  Pop $0
  CreateFont $1 "$(^Font)" 12 700
  SendMessage $0 ${WM_SETFONT} $1 1
  ${NSD_CreateLabel} 0 30u 100% 48u "$(FableviaUninstallBody)"
  Pop $0
  ${NSD_CreateCheckbox} 0 92u 100% 18u "$(FableviaDeleteUserData)"
  Pop $FableviaDeleteUserDataCheckbox
  ${NSD_Uncheck} $FableviaDeleteUserDataCheckbox
  ${NSD_CreateLabel} 0 120u 100% 30u "$(FableviaDeleteUserDataNote)"
  Pop $0
  nsDialogs::Show
FunctionEnd

Function un.FableviaUninstallOptionsLeave
  ${NSD_GetState} $FableviaDeleteUserDataCheckbox $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $FableviaDeleteUserDataFlag "1"
  ${Else}
    StrCpy $FableviaDeleteUserDataFlag "0"
  ${EndIf}
FunctionEnd
!endif
