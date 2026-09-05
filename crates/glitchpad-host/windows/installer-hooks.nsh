!macro GLITCHPAD_BACKUP_ASSOCIATION EXT FILECLASS
  ReadRegStr $R0 SHCTX "Software\Classes\.${EXT}" ""
  StrCmp $R0 "${FILECLASS}" glitchpad_backup_done_${EXT}
  ReadRegStr $R1 SHCTX "Software\Classes\.${EXT}" "Glitchpad_Backup_Recorded"
  StrCmp $R1 "1" glitchpad_backup_done_${EXT}
  WriteRegStr SHCTX "Software\Classes\.${EXT}" "Glitchpad_Backup_Value" "$R0"
  WriteRegStr SHCTX "Software\Classes\.${EXT}" "Glitchpad_Backup_Recorded" "1"
  glitchpad_backup_done_${EXT}:
!macroend

!macro GLITCHPAD_RESTORE_ASSOCIATION EXT FILECLASS
  ReadRegStr $R0 SHCTX "Software\Classes\.${EXT}" ""
  StrCmp $R0 "${FILECLASS}" 0 glitchpad_restore_cleanup_${EXT}
  ReadRegStr $R1 SHCTX "Software\Classes\.${EXT}" "Glitchpad_Backup_Recorded"
  StrCmp $R1 "1" 0 glitchpad_restore_clear_${EXT}
  ReadRegStr $R2 SHCTX "Software\Classes\.${EXT}" "Glitchpad_Backup_Value"
  StrCmp $R2 "" 0 glitchpad_restore_value_${EXT}
  DeleteRegValue SHCTX "Software\Classes\.${EXT}" ""
  Goto glitchpad_restore_cleanup_${EXT}
  glitchpad_restore_value_${EXT}:
  WriteRegStr SHCTX "Software\Classes\.${EXT}" "" "$R2"
  Goto glitchpad_restore_cleanup_${EXT}
  glitchpad_restore_clear_${EXT}:
  DeleteRegValue SHCTX "Software\Classes\.${EXT}" ""
  glitchpad_restore_cleanup_${EXT}:
  DeleteRegValue SHCTX "Software\Classes\.${EXT}" "Glitchpad_Backup_Value"
  DeleteRegValue SHCTX "Software\Classes\.${EXT}" "Glitchpad_Backup_Recorded"
  DeleteRegKey /ifempty SHCTX "Software\Classes\.${EXT}"
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "md" "Glitchpad Markdown"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "markdown" "Glitchpad Markdown"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "mmd" "Glitchpad Mermaid"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "mermaid" "Glitchpad Mermaid"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "txt" "Glitchpad Text"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "cjs" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "css" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "htm" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "html" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "js" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "json" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "jsonc" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "jsx" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "mjs" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "py" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "rs" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "toml" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "ts" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "tsx" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "yaml" "Glitchpad Source"
  !insertmacro GLITCHPAD_BACKUP_ASSOCIATION "yml" "Glitchpad Source"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "md" "Glitchpad Markdown"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "markdown" "Glitchpad Markdown"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "mmd" "Glitchpad Mermaid"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "mermaid" "Glitchpad Mermaid"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "txt" "Glitchpad Text"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "cjs" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "css" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "htm" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "html" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "js" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "json" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "jsonc" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "jsx" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "mjs" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "py" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "rs" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "toml" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "ts" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "tsx" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "yaml" "Glitchpad Source"
  !insertmacro GLITCHPAD_RESTORE_ASSOCIATION "yml" "Glitchpad Source"
!macroend
