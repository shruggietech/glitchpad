package com.shruggietech.glitchpad.source;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

public final class FixtureGrantActivity extends Activity {
  static final String ACTION_GRANT = "com.shruggietech.glitchpad.fixture.GRANT_URI";
  static final String EXTRA_URI = "fixture_uri";
  private static final int MODES =
      Intent.FLAG_GRANT_READ_URI_PERMISSION
          | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
          | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    String encodedUri = getIntent().getStringExtra(EXTRA_URI);
    if (ACTION_GRANT.equals(getIntent().getAction()) && encodedUri != null) {
      grantUriPermission("com.shruggietech.glitchpad", Uri.parse(encodedUri), MODES);
    }
    finish();
  }
}
