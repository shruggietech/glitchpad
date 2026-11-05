package com.shruggietech.glitchpad.source;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Process;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Actual external recipient for temporary diagnostic Share read grants. */
public final class DiagnosticShareReceiverActivity extends Activity {
  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    try {
      Uri uri = getIntent().getParcelableExtra(Intent.EXTRA_STREAM);
      if (uri == null || !"application/json".equals(getIntent().getType())) throw new IllegalStateException("share_contract");
      boolean granted = checkUriPermission(uri, Process.myPid(), Process.myUid(), Intent.FLAG_GRANT_READ_URI_PERMISSION) == PackageManager.PERMISSION_GRANTED;
      if (!granted) throw new IllegalStateException("share_read_grant_missing");
      ByteArrayOutputStream bytes = new ByteArrayOutputStream();
      try (InputStream input = getContentResolver().openInputStream(uri)) {
        if (input == null) throw new IllegalStateException("share_stream_missing");
        byte[] buffer = new byte[4096];
        int count;
        while ((count = input.read(buffer)) != -1) {
          if (bytes.size() + count > 1024 * 1024) throw new IllegalStateException("share_budget");
          bytes.write(buffer, 0, count);
        }
      }
      String json = new String(bytes.toByteArray(), StandardCharsets.UTF_8);
      new org.json.JSONObject(json);
      getSharedPreferences("s046-share", 0).edit().putString("json", json).putBoolean("read_granted", true).commit();
    } catch (Exception error) {
      getSharedPreferences("s046-share", 0).edit().putString("error", "receiver_failed").commit();
    } finally { finish(); }
  }
}
