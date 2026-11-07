package com.shruggietech.glitchpad.source;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Process;
import android.text.InputType;
import android.widget.EditText;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.json.JSONObject;

/** Independent UID exercises the platform text widget's actual clipboard paste path. */
public final class ClipboardPasteReceiverActivity extends Activity {
  private EditText editor;
  private boolean requested;

  @Override protected void onCreate(Bundle state) {
    super.onCreate(state);
    editor = new EditText(this);
    editor.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
    editor.setShowSoftInputOnFocus(false);
    editor.setHint("Clipboard paste readback");
    setContentView(editor);
    editor.requestFocus();
  }

  @Override public void onWindowFocusChanged(boolean focused) {
    super.onWindowFocusChanged(focused);
    if (focused && !requested) {
      requested = true;
      editor.post(this::pasteAndRecord);
    }
  }

  private void pasteAndRecord() {
    JSONObject result = new JSONObject();
    try {
      result.put("nonce", getIntent().getStringExtra("nonce"));
      result.put("receiver_package", getPackageName()).put("receiver_uid", Process.myUid());
      ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
      ClipData clip = clipboard.getPrimaryClip();
      if (clip == null || clip.getItemCount() != 1) throw new IllegalStateException("clipboard_item_missing");
      result.put("plain_text_mime", clip.getDescription().hasMimeType("text/plain"));
      Uri uri = clip.getItemAt(0).getUri();
      result.put("has_uri", uri != null);
      result.put("intent_uri_grant", (getIntent().getFlags() & Intent.FLAG_GRANT_READ_URI_PERMISSION) != 0);
      result.put("uri_write_granted", uri != null && checkUriPermission(uri, Process.myPid(), Process.myUid(), Intent.FLAG_GRANT_WRITE_URI_PERMISSION) == PackageManager.PERMISSION_GRANTED);
      result.put("uri_read_granted", uri != null && checkUriPermission(uri, Process.myPid(), Process.myUid(), Intent.FLAG_GRANT_READ_URI_PERMISSION) == PackageManager.PERMISSION_GRANTED);
      result.put("paste_accepted", editor.onTextContextMenuItem(android.R.id.paste));
      String actual = editor.getText().toString();
      byte[] bytes = actual.getBytes(StandardCharsets.UTF_8);
      StringBuilder digest = new StringBuilder();
      for (byte value : MessageDigest.getInstance("SHA-256").digest(bytes)) {
        digest.append(Character.forDigit((value >>> 4) & 15, 16));
        digest.append(Character.forDigit(value & 15, 16));
      }
      result.put("utf8_bytes", bytes.length).put("code_units", actual.length()).put("sha256", digest.toString());
    } catch (Exception error) {
      try { result.put("error", error.getClass().getSimpleName()); } catch (Exception ignored) { }
    } finally {
      getSharedPreferences("s047-clipboard", 0).edit().putString("json", result.toString()).commit();
      finish();
    }
  }
}
