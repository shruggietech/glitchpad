package com.shruggietech.glitchpad.source;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

public final class FixtureGrantActivity extends Activity {
  static final String ACTION_GRANT = "com.shruggietech.glitchpad.fixture.GRANT_URI";
  static final String ACTION_REVOKE = "com.shruggietech.glitchpad.fixture.REVOKE_URI";
  static final String EXTRA_URI = "fixture_uri";
  private static final int MODES =
      Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    String encodedUri = getIntent().getStringExtra(EXTRA_URI);
    if (encodedUri == null) {
      finish();
      return;
    }
    Uri uri = Uri.parse(encodedUri);
    if (ACTION_GRANT.equals(getIntent().getAction())) {
      grantUriPermission("com.shruggietech.glitchpad", uri, MODES);
    } else if (ACTION_REVOKE.equals(getIntent().getAction())) {
      revokeUriPermission(uri, MODES);
    }
    finish();
  }
}
