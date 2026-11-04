package com.shruggietech.glitchpad.source;

import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.os.CancellationSignal;
import android.os.Bundle;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract.Document;
import android.provider.DocumentsContract.Root;
import android.provider.DocumentsProvider;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Comparator;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public final class FixtureDocumentsProvider extends DocumentsProvider {
  private static final String ROOT_ID = "fixture-root";
  private static volatile int providerProcessId;
  private static HeldWrite heldWrite;

  private static final class HeldWrite {
    final String documentId;
    final CountDownLatch release = new CountDownLatch(1);
    volatile boolean finished;
    volatile boolean timedOut;
    int enteredCount;
    int enteredProcessId;
    boolean enteredOnMainThread;

    HeldWrite(String documentId) { this.documentId = documentId; }
  }

  static synchronized Bundle armHeldWrite(String documentId) {
    if (providerProcessId != android.os.Process.myPid()) {
      throw new IllegalStateException("fixture_providers_do_not_share_process");
    }
    if (heldWrite != null && !heldWrite.finished) {
      throw new IllegalStateException("fixture_write_already_armed");
    }
    heldWrite = new HeldWrite(documentId);
    return heldWriteStatus(documentId);
  }

  static synchronized Bundle heldWriteStatus(String documentId) {
    if (heldWrite == null || !heldWrite.documentId.equals(documentId)) {
      throw new IllegalStateException("fixture_write_not_armed");
    }
    Bundle status = new Bundle();
    status.putInt("provider_process_id", providerProcessId);
    status.putInt("entered_process_id", heldWrite.enteredProcessId);
    status.putInt("entered_count", heldWrite.enteredCount);
    status.putBoolean("entered_on_main_thread", heldWrite.enteredOnMainThread);
    status.putBoolean("released", heldWrite.release.getCount() == 0);
    status.putBoolean("finished", heldWrite.finished);
    status.putBoolean("timed_out", heldWrite.timedOut);
    return status;
  }

  static synchronized Bundle releaseHeldWrite(String documentId) {
    if (heldWrite == null || !heldWrite.documentId.equals(documentId)) {
      throw new IllegalStateException("fixture_write_not_armed");
    }
    heldWrite.release.countDown();
    return heldWriteStatus(documentId);
  }

  private static void awaitHeldWrite(String documentId) throws FileNotFoundException {
    final HeldWrite barrier;
    synchronized (FixtureDocumentsProvider.class) {
      if (heldWrite == null || !heldWrite.documentId.equals(documentId) || heldWrite.finished) return;
      barrier = heldWrite;
      barrier.enteredCount++;
      barrier.enteredProcessId = android.os.Process.myPid();
      barrier.enteredOnMainThread = Looper.myLooper() == Looper.getMainLooper();
    }
    try {
      if (!barrier.release.await(30, TimeUnit.SECONDS)) {
        barrier.timedOut = true;
        throw new FileNotFoundException("fixture_held_write_timed_out");
      }
      // Refuse before opening the rw descriptor: no destination bytes can be changed.
      throw new FileNotFoundException("fixture_held_write_refused");
    } catch (InterruptedException error) {
      Thread.currentThread().interrupt();
      FileNotFoundException failure = new FileNotFoundException("fixture_held_write_interrupted");
      failure.initCause(error);
      throw failure;
    } finally {
      barrier.finished = true;
    }
  }
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
    providerProcessId = android.os.Process.myPid();
    File directory = fixtureDirectory();
    if (!directory.exists() && !directory.mkdirs()) {
      throw new IllegalStateException("fixture_directory_create_failed");
    }
    writeFixture(directory, "seekable.txt", "seekable fixture payload");
    writeFixture(directory, "unknown-size.txt", "unknown size payload");
    writeFixture(directory, "metadata-omitted.txt", "metadata omission payload");
    writeFixture(directory, "\u05e9\u05dc\u05d5\u05dd-e\u0301-\ud83e\uddea.txt", "unicode metadata payload");
    writeFixture(directory, "pipe.txt", "pipe fixture payload");
    writeFixture(directory, "diagram.mmd", "flowchart LR\nSource --> Session\n");
    writeFixture(directory, "resolver-cold.md", "# S031 cold delivery\n\nS031_COLD_MARKER_4F2A\n");
    writeFixture(directory, "resolver-warm.txt", "S031_WARM_MARKER_7C9D\n");
    writeFixture(directory, "recovery-readonly.md", "# Read-only source\n\nS046_ORIGINAL_UNCHANGED\n");
    String recoveryCorpus = "# S046 Markdown corpus\n\nS046_CORPUS_MARKER\n\n- list item\n\n[local link](#s046-markdown-corpus)\n\n[external destination](https://example.invalid/s046)\n\n```text\ncode block\n```\n\n| Column | Value |\n| --- | --- |\n| row | Unicode \u03a9 \ud83e\uddea |\n";
    writeFixture(directory, "recovery-corpus.md", recoveryCorpus);
    writeFixture(directory, "recovery-warm-corpus.md", recoveryCorpus);
    writeFixture(directory, "recovery-empty.md", "");
    writeFixture(directory, "recovery-malformed.md", "# Incomplete [link\n\n```unclosed\nS046_MALFORMED_MARKER\n");
    for (String name : new String[] {"original.png", "original.jpg", "original.webp", "original.bmp", "original.tiff", "original.gif", "animated.webp", "original.svg", "entries.ico", "hostile.svg"}) {
      try {
        FixtureCanonicalFiles.initialize(new File(directory, name), () -> getContext().getAssets().open(name), false);
      } catch (IOException error) {
        throw new IllegalStateException("raster_fixture_copy_failed", error);
      }
    }
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
    if ("provider-unavailable.txt".equals(documentId)) {
      if (projection != null
          && projection.length == 1
          && Document.COLUMN_DOCUMENT_ID.equals(projection[0])) {
        MatrixCursor grantProbe = new MatrixCursor(projection);
        grantProbe.newRow().add(Document.COLUMN_DOCUMENT_ID, documentId);
        return grantProbe;
      }
      return null;
    }
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
    if (mode.contains("w") && ("recovery-readonly.md".equals(documentId) || documentId.startsWith("s046-write-refused-"))) {
      throw new FileNotFoundException("fixture_write_refused");
    }
    if ("pipe.txt".equals(documentId) && !mode.contains("w")) {
      return openPipe(file);
    }
    if (mode.contains("w")) awaitHeldWrite(documentId);
    int access =
        mode.contains("w")
            ? ParcelFileDescriptor.MODE_READ_WRITE | ParcelFileDescriptor.MODE_CREATE
            : ParcelFileDescriptor.MODE_READ_ONLY;
    return ParcelFileDescriptor.open(file, access);
  }

  @Override
  public String createDocument(String parentDocumentId, String mimeType, String displayName)
      throws FileNotFoundException {
    if (!ROOT_ID.equals(parentDocumentId) || !("text/plain".equals(mimeType) || "text/markdown".equals(mimeType) || "application/json".equals(mimeType) || "image/png".equals(mimeType))) {
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
    byte[] expected = content.getBytes(StandardCharsets.UTF_8);
    try {
      FixtureCanonicalFiles.initialize(new File(directory, name), () -> new ByteArrayInputStream(expected), true);
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
    row.add(Document.COLUMN_DOCUMENT_ID, documentId);
    if (!"metadata-omitted.txt".equals(documentId)) {
      row.add(Document.COLUMN_DISPLAY_NAME, displayName(documentId));
    }
    row.add(Document.COLUMN_MIME_TYPE, mimeType(documentId));
    row.add(
        Document.COLUMN_FLAGS,
        ("recovery-readonly.md".equals(documentId) ? 0 : Document.FLAG_SUPPORTS_WRITE)
            | Document.FLAG_SUPPORTS_RENAME
            | Document.FLAG_SUPPORTS_DELETE);
    if (!"unknown-size.txt".equals(file.getName())
        && !"metadata-omitted.txt".equals(file.getName())) {
      row.add(Document.COLUMN_SIZE, file.getName().startsWith("s040-misreported-") ? 0L : file.length());
    }
    if (!"metadata-omitted.txt".equals(file.getName())) {
      row.add(Document.COLUMN_LAST_MODIFIED, file.lastModified());
    }
  }

  private File fixtureDirectory() {
    Context context = getContext();
    if (context == null) {
      throw new IllegalStateException("fixture_context_unavailable");
    }
    return new File(context.getFilesDir(), "document-provider-fixtures");
  }

  private static String mimeType(String name) {
    if (name.startsWith("original.")) {
      if (name.endsWith(".jpg")) return "image/jpeg";
      if (name.endsWith(".tiff")) return "image/tiff";
      return "image/" + name.substring("original.".length());
    }
    if (name.endsWith(".json")) return "application/json";
    if (name.endsWith(".md")) return "text/markdown";
    if ("resolver-cold".equals(name)) {
      return "text/markdown";
    }
    return name.endsWith(".mmd") || name.endsWith(".mermaid")
        ? "text/vnd.mermaid"
        : "text/plain";
  }

  private static String displayName(String documentId) {
    if ("resolver-cold".equals(documentId)) {
      return "resolver-cold.md";
    }
    if ("resolver-warm".equals(documentId)) {
      return "resolver-warm.txt";
    }
    return documentId;
  }

  private static String storageName(String documentId) {
    if ("resolver-cold".equals(documentId)) {
      return "resolver-cold.md";
    }
    if ("resolver-warm".equals(documentId)) {
      return "resolver-warm.txt";
    }
    return documentId;
  }

  private File documentFile(String documentId) throws FileNotFoundException {
    if (ROOT_ID.equals(documentId) || documentId.indexOf('/') >= 0 || documentId.indexOf('\\') >= 0) {
      throw new FileNotFoundException(documentId);
    }
    File file = new File(fixtureDirectory(), storageName(documentId));
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
