package com.shruggietech.glitchpad.source;

import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract.Document;
import android.provider.DocumentsContract.Root;
import android.provider.DocumentsProvider;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Comparator;

public final class FixtureDocumentsProvider extends DocumentsProvider {
  private static final String ROOT_ID = "fixture-root";
  private static final String[] ROOT_COLUMNS = {
    Root.COLUMN_ROOT_ID,
    Root.COLUMN_DOCUMENT_ID,
    Root.COLUMN_TITLE,
    Root.COLUMN_FLAGS,
    Root.COLUMN_MIME_TYPES,
    Root.COLUMN_AVAILABLE_BYTES,
  };
  private static final String[] DOCUMENT_COLUMNS = {
    Document.COLUMN_DOCUMENT_ID,
    Document.COLUMN_DISPLAY_NAME,
    Document.COLUMN_MIME_TYPE,
    Document.COLUMN_FLAGS,
    Document.COLUMN_SIZE,
    Document.COLUMN_LAST_MODIFIED,
  };

  @Override
  public boolean onCreate() {
    File directory = fixtureDirectory();
    if (!directory.exists() && !directory.mkdirs()) {
      throw new IllegalStateException("fixture_directory_create_failed");
    }
    writeFixture(directory, "seekable.txt", "seekable fixture payload");
    writeFixture(directory, "unknown-size.txt", "unknown size payload");
    writeFixture(directory, "pipe.txt", "pipe fixture payload");
    writeFixture(directory, "diagram.mmd", "flowchart LR\nSource --> Session\n");
    return true;
  }

  @Override
  public Cursor queryRoots(String[] projection) {
    MatrixCursor cursor = new MatrixCursor(projection == null ? ROOT_COLUMNS : projection);
    MatrixCursor.RowBuilder row = cursor.newRow();
    row.add(Root.COLUMN_ROOT_ID, ROOT_ID);
    row.add(Root.COLUMN_DOCUMENT_ID, ROOT_ID);
    row.add(Root.COLUMN_TITLE, "Glitchpad fixtures");
    row.add(Root.COLUMN_FLAGS, Root.FLAG_SUPPORTS_CREATE);
    row.add(Root.COLUMN_MIME_TYPES, "text/plain\ntext/vnd.mermaid");
    row.add(Root.COLUMN_AVAILABLE_BYTES, fixtureDirectory().getUsableSpace());
    return cursor;
  }

  @Override
  public Cursor queryDocument(String documentId, String[] projection) throws FileNotFoundException {
    MatrixCursor cursor = new MatrixCursor(projection == null ? DOCUMENT_COLUMNS : projection);
    includeDocument(cursor, documentId);
    return cursor;
  }

  @Override
  public Cursor queryChildDocuments(String parentDocumentId, String[] projection, String sortOrder)
      throws FileNotFoundException {
    if (!ROOT_ID.equals(parentDocumentId)) {
      throw new FileNotFoundException(parentDocumentId);
    }
    MatrixCursor cursor = new MatrixCursor(projection == null ? DOCUMENT_COLUMNS : projection);
    File[] files = fixtureDirectory().listFiles();
    if (files == null) {
      return cursor;
    }
    Arrays.sort(files, Comparator.comparing(File::getName));
    for (File file : files) {
      includeDocument(cursor, file.getName());
    }
    return cursor;
  }

  @Override
  public String getDocumentType(String documentId) {
    return ROOT_ID.equals(documentId) ? Document.MIME_TYPE_DIR : mimeType(documentId);
  }

  @Override
  public ParcelFileDescriptor openDocument(
      String documentId, String mode, CancellationSignal signal) throws FileNotFoundException {
    if (signal != null) {
      signal.throwIfCanceled();
    }
    File file = documentFile(documentId);
    if ("pipe.txt".equals(documentId) && !mode.contains("w")) {
      return openPipe(file);
    }
    int access =
        mode.contains("w")
            ? ParcelFileDescriptor.MODE_READ_WRITE | ParcelFileDescriptor.MODE_CREATE
            : ParcelFileDescriptor.MODE_READ_ONLY;
    return ParcelFileDescriptor.open(file, access);
  }

  @Override
  public String createDocument(String parentDocumentId, String mimeType, String displayName)
      throws FileNotFoundException {
    if (!ROOT_ID.equals(parentDocumentId) || !"text/plain".equals(mimeType)) {
      throw new FileNotFoundException(parentDocumentId);
    }
    String safeName = safeName(displayName);
    File file = new File(fixtureDirectory(), safeName.isEmpty() ? "untitled.txt" : safeName);
    try {
      if (!file.exists() && !file.createNewFile()) {
        throw new IOException("fixture_create_failed");
      }
    } catch (IOException error) {
      throw fileNotFound(file.getName(), error);
    }
    return file.getName();
  }

  @Override
  public String renameDocument(String documentId, String displayName) throws FileNotFoundException {
    File source = documentFile(documentId);
    File target = new File(fixtureDirectory(), safeName(displayName));
    if (!source.renameTo(target)) {
      throw new IllegalStateException("rename_failed");
    }
    return target.getName();
  }

  @Override
  public void deleteDocument(String documentId) throws FileNotFoundException {
    if (!documentFile(documentId).delete()) {
      throw new IllegalStateException("delete_failed");
    }
  }

  private static void writeFixture(File directory, String name, String content) {
    try (FileOutputStream output = new FileOutputStream(new File(directory, name), false)) {
      output.write(content.getBytes(StandardCharsets.UTF_8));
      output.getFD().sync();
    } catch (IOException error) {
      throw new IllegalStateException("fixture_write_failed", error);
    }
  }

  private static ParcelFileDescriptor openPipe(File file) throws FileNotFoundException {
    final ParcelFileDescriptor[] pipe;
    try {
      pipe = ParcelFileDescriptor.createPipe();
    } catch (IOException error) {
      throw fileNotFound(file.getName(), error);
    }
    Thread writer =
        new Thread(
            () -> {
              try (FileInputStream input = new FileInputStream(file);
                  ParcelFileDescriptor.AutoCloseOutputStream output =
                      new ParcelFileDescriptor.AutoCloseOutputStream(pipe[1])) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                  output.write(buffer, 0, count);
                }
              } catch (IOException error) {
                try {
                  pipe[1].closeWithError(error.getMessage());
                } catch (IOException ignored) {
                  // The reader already owns the only observable failure channel.
                }
              }
            },
            "fixture-provider-pipe");
    writer.setDaemon(true);
    writer.start();
    return pipe[0];
  }

  private void includeDocument(MatrixCursor cursor, String documentId) throws FileNotFoundException {
    MatrixCursor.RowBuilder row = cursor.newRow();
    if (ROOT_ID.equals(documentId)) {
      row.add(Document.COLUMN_DOCUMENT_ID, ROOT_ID);
      row.add(Document.COLUMN_DISPLAY_NAME, "Glitchpad fixtures");
      row.add(Document.COLUMN_MIME_TYPE, Document.MIME_TYPE_DIR);
      row.add(Document.COLUMN_FLAGS, Document.FLAG_DIR_SUPPORTS_CREATE);
      return;
    }
    File file = documentFile(documentId);
    row.add(Document.COLUMN_DOCUMENT_ID, file.getName());
    row.add(Document.COLUMN_DISPLAY_NAME, file.getName());
    row.add(Document.COLUMN_MIME_TYPE, mimeType(file.getName()));
    row.add(
        Document.COLUMN_FLAGS,
        Document.FLAG_SUPPORTS_WRITE
            | Document.FLAG_SUPPORTS_RENAME
            | Document.FLAG_SUPPORTS_DELETE);
    if (!"unknown-size.txt".equals(file.getName())) {
      row.add(Document.COLUMN_SIZE, file.length());
    }
    row.add(Document.COLUMN_LAST_MODIFIED, file.lastModified());
  }

  private File fixtureDirectory() {
    Context context = getContext();
    if (context == null) {
      throw new IllegalStateException("fixture_context_unavailable");
    }
    return new File(context.getFilesDir(), "document-provider-fixtures");
  }

  private static String mimeType(String name) {
    return name.endsWith(".mmd") || name.endsWith(".mermaid")
        ? "text/vnd.mermaid"
        : "text/plain";
  }

  private File documentFile(String documentId) throws FileNotFoundException {
    if (ROOT_ID.equals(documentId) || documentId.indexOf('/') >= 0 || documentId.indexOf('\\') >= 0) {
      throw new FileNotFoundException(documentId);
    }
    File file = new File(fixtureDirectory(), documentId);
    if (!file.exists()) {
      throw new FileNotFoundException(documentId);
    }
    return file;
  }

  private static String safeName(String displayName) {
    String sanitized = displayName.replaceAll("[^A-Za-z0-9._ -]", "_");
    return sanitized.substring(0, Math.min(sanitized.length(), 80));
  }

  private static FileNotFoundException fileNotFound(String message, IOException cause) {
    FileNotFoundException error = new FileNotFoundException(message);
    error.initCause(cause);
    return error;
  }
}
