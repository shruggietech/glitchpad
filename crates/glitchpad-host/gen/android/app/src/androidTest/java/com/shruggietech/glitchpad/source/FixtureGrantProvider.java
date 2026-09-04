package com.shruggietech.glitchpad.source;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;

public final class FixtureGrantProvider extends ContentProvider {
  static final Uri COMMAND_URI = Uri.parse("content://com.shruggietech.glitchpad.fixture.grants");
  static final String METHOD_GRANT = "grant";
  private static final String DOCUMENT_AUTHORITY =
      "com.shruggietech.glitchpad.fixture.documents";
  private static final String TARGET_PACKAGE = "com.shruggietech.glitchpad";
  private static final int MODES =
      Intent.FLAG_GRANT_READ_URI_PERMISSION
          | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
          | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION;

  @Override
  public boolean onCreate() {
    return true;
  }

  @Override
  public Bundle call(String method, String argument, Bundle extras) {
    if (!METHOD_GRANT.equals(method) || argument == null) {
      throw new IllegalArgumentException("unsupported fixture grant request");
    }
    Uri uri = Uri.parse(argument);
    if (!DOCUMENT_AUTHORITY.equals(uri.getAuthority())) {
      throw new SecurityException("fixture grant URI must use the controlled document authority");
    }
    Context context = getContext();
    if (context == null) {
      throw new IllegalStateException("fixture grant provider has no context");
    }
    context.grantUriPermission(TARGET_PACKAGE, uri, MODES);
    return new Bundle();
  }

  @Override
  public Cursor query(
      Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
    throw new UnsupportedOperationException("fixture grant provider exposes only call()");
  }

  @Override
  public String getType(Uri uri) {
    return null;
  }

  @Override
  public Uri insert(Uri uri, ContentValues values) {
    throw new UnsupportedOperationException("fixture grant provider exposes only call()");
  }

  @Override
  public int delete(Uri uri, String selection, String[] selectionArgs) {
    throw new UnsupportedOperationException("fixture grant provider exposes only call()");
  }

  @Override
  public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
    throw new UnsupportedOperationException("fixture grant provider exposes only call()");
  }
}
