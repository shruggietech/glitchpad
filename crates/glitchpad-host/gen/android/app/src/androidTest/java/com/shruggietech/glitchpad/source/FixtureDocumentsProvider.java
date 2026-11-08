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
  private static final java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.atomic.AtomicInteger> READ_FAILURES = new java.util.concurrent.ConcurrentHashMap<>();

  static Bundle configureReadFailure(String documentId, int allowedReads) {
    if (allowedReads < 0 || allowedReads > 8) throw new IllegalArgumentException("fixture_read_budget_invalid");
    READ_FAILURES.put(documentId, new java.util.concurrent.atomic.AtomicInteger(allowedReads));
    Bundle result = new Bundle(); result.putInt("provider_process_id", android.os.Process.myPid()); return result;
  }

  static Bundle clearReadFailure(String documentId) {
    READ_FAILURES.remove(documentId); return new Bundle();
  }
  private static final String ROOT_ID = "fixture-root";
  private static volatile int providerProcessId;
  private static HeldOperation heldWrite;
  private static HeldOperation heldRead;

  private static final class HeldOperation {
    final String documentId;
    final CountDownLatch release = new CountDownLatch(1);
    volatile boolean finished;
    volatile boolean timedOut;
    int enteredCount;
    int enteredProcessId;
    boolean enteredOnMainThread;
    HeldOperation(String documentId) { this.documentId = documentId; }
  }
  private static HeldOperation matchingOperation(String documentId, boolean read) {
    HeldOperation current = read ? heldRead : heldWrite;
    if (current == null || !current.documentId.equals(documentId)) throw new IllegalStateException(read ? "fixture_read_not_armed" : "fixture_write_not_armed");
    return current;
  }
  private static Bundle operationStatus(HeldOperation operation) {
    Bundle status = new Bundle();
    status.putInt("provider_process_id", providerProcessId);
    status.putInt("entered_process_id", operation.enteredProcessId);
    status.putInt("entered_count", operation.enteredCount);
    status.putBoolean("entered_on_main_thread", operation.enteredOnMainThread);
    status.putBoolean("released", operation.release.getCount() == 0);
    status.putBoolean("finished", operation.finished);
    status.putBoolean("timed_out", operation.timedOut);
    return status;
  }
  private static synchronized Bundle armOperation(String documentId, boolean read) {
    if (providerProcessId != android.os.Process.myPid()) throw new IllegalStateException("fixture_providers_do_not_share_process");
    HeldOperation previous = read ? heldRead : heldWrite;
    if (previous != null && !previous.finished) throw new IllegalStateException(read ? "fixture_read_already_armed" : "fixture_write_already_armed");
    HeldOperation operation = new HeldOperation(documentId);
    if (read) heldRead = operation; else heldWrite = operation;
    return operationStatus(operation);
  }
  private static synchronized Bundle releaseOperation(String documentId, boolean read) {
    HeldOperation operation = matchingOperation(documentId, read);
    operation.release.countDown();
    return operationStatus(operation);
  }
  static Bundle armHeldWrite(String documentId) { return armOperation(documentId, false); }
  static synchronized Bundle heldWriteStatus(String documentId) { return operationStatus(matchingOperation(documentId, false)); }
  static Bundle releaseHeldWrite(String documentId) { return releaseOperation(documentId, false); }
  static Bundle armHeldRead(String documentId) { return armOperation(documentId, true); }
  static synchronized Bundle heldReadStatus(String documentId) { return operationStatus(matchingOperation(documentId, true)); }
  static Bundle releaseHeldRead(String documentId) { return releaseOperation(documentId, true); }
  private static void awaitHeldWrite(String documentId) throws FileNotFoundException { awaitOperation(documentId, false); }
  private static void awaitHeldRead(String documentId) throws FileNotFoundException { awaitOperation(documentId, true); }
  private static void awaitOperation(String documentId, boolean read) throws FileNotFoundException {
    final HeldOperation barrier;
    synchronized (FixtureDocumentsProvider.class) {
      HeldOperation current = read ? heldRead : heldWrite;
      if (current == null || !current.documentId.equals(documentId) || current.finished) return;
      barrier = current;
      barrier.enteredCount++;
      barrier.enteredProcessId = android.os.Process.myPid();
      barrier.enteredOnMainThread = Looper.myLooper() == Looper.getMainLooper();
    }
    try {
      if (!barrier.release.await(30, TimeUnit.SECONDS)) {
        barrier.timedOut = true;
        throw new FileNotFoundException(read ? "fixture_held_read_timed_out" : "fixture_held_write_timed_out");
      }
      // The existing held write always refuses before a destructive descriptor open.
      if (!read) throw new FileNotFoundException("fixture_held_write_refused");
    } catch (InterruptedException error) {
      Thread.currentThread().interrupt();
      FileNotFoundException failure = new FileNotFoundException(read ? "fixture_held_read_interrupted" : "fixture_held_write_interrupted");
      failure.initCause(error); throw failure;
    } finally { barrier.finished = true; }
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
    for (String name : new String[] {"s049-compatibility.pdf", "s049-small.pdf", "s049-malformed.pdf"}) {
      try { FixtureCanonicalFiles.initialize(new File(directory, name), () -> getContext().getAssets().open(name), false); }
      catch (IOException error) { throw new IllegalStateException("pdf_fixture_copy_failed", error); }
    }
    writeFixture(directory, "seekable.txt", "seekable fixture payload");
    writeFixture(directory, "unknown-size.txt", "unknown size payload");
    writeFixture(directory, "metadata-omitted.txt", "metadata omission payload");
    writeFixture(directory, "\u05e9\u05dc\u05d5\u05dd-e\u0301-\ud83e\uddea.txt", "unicode metadata payload");
    writeFixture(directory, "pipe.txt", "pipe fixture payload");
    try { FixtureCanonicalFiles.initialize(new File(directory,"s049-stream.pdf"), () -> new FileInputStream(new File(directory,"s049-compatibility.pdf")), false); } catch(IOException error) { throw new IllegalStateException("pdf_stream_fixture_copy_failed",error); }
    writeFixture(directory, "diagram.mmd", "flowchart LR\nSource --> Session\n");
    writeFixture(directory, "resolver-cold.md", "# S031 cold delivery\n\nS031_COLD_MARKER_4F2A\n");
    writeFixture(directory, "resolver-warm.txt", "S031_WARM_MARKER_7C9D\n");
    writeFixture(directory, "recovery-readonly.md", "# Read-only source\n\nS046_ORIGINAL_UNCHANGED\n");
    String recoveryCorpus = "# S046 Markdown corpus\n\nS046_CORPUS_MARKER\n\n- list item\n\n[local link](#s046-markdown-corpus)\n\n[external destination](https://example.invalid/s046)\n\n```text\ncode block\n```\n\n| Column | Value |\n| --- | --- |\n| row | Unicode \u03a9 \ud83e\uddea |\n";
    writeFixture(directory, "recovery-corpus.md", recoveryCorpus);
    writeFixture(directory, "recovery-warm-corpus.md", recoveryCorpus);
    writeFixture(directory, "s047-controls.md", "# S047 controls\n\nFind cats and dogs.\n\n## Second heading\n\n[local](#second-heading)\n\n[sibling](s047-controls.mmd)\n\n[external](https://example.invalid/s047)\n\n[email](mailto:s047@example.invalid)\n\nNote[^one].\n\n[^one]: S047 footnote detail.\n\n```mermaid\nflowchart TB\nCats --> Dogs\n```\n\n- [ ] Passive task\n- [x] Complete passive task\n");
    writeFixture(directory, "s047-invalid.mmd", "flowchart TB\nA -->\n");
    writeFixture(directory, "s047-invalid-diagram.md", "# Invalid embedded diagram\n\n\u0060\u0060\u0060mermaid\nflowchart TB\nA -->\n\u0060\u0060\u0060\n");
    writeFixture(directory, "s047-controls.mmd", "flowchart TB\nCats --> Dogs\nCats --> Birds\n");
    writeFixture(directory, "recovery-empty.md", "");
    writeFixture(directory, "recovery-malformed.md", "# Incomplete [link\n\n```unclosed\nS046_MALFORMED_MARKER\n");
    for (String name : new String[] {"original.png", "orientation-6.jpg", "original.jpg", "original.webp", "original.bmp", "original.tiff", "original.gif", "s047-playback.gif", "animated.webp", "original.svg", "entries.ico", "hostile.svg", "svg-presentation.svg", "svg-namespaced.svg", "svg-reuse.svg", "svg-external.svg", "svg-cycle.svg", "svg-malformed.svg", "svg-unsupported.svg", "svg-missing.svg", "svg-resource.svg", "svg-viewport.svg", "svg-read-denied.svg"}) {
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
    if ("s047-large.txt".equals(documentId)) ensureLargeFixture();
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
    if ("s047-large.txt".equals(documentId)) ensureLargeFixture();
    File file = documentFile(documentId);
    if (!mode.contains("w")) { awaitHeldRead(documentId); if (signal != null) signal.throwIfCanceled(); }
    java.util.concurrent.atomic.AtomicInteger remainingReads = READ_FAILURES.get(documentId);
    if (!mode.contains("w") && remainingReads != null && remainingReads.getAndDecrement() <= 0) throw new FileNotFoundException("fixture_read_denied");
    if (mode.contains("w") && ("recovery-readonly.md".equals(documentId) || documentId.startsWith("s046-write-refused-"))) {
      throw new FileNotFoundException("fixture_write_refused");
    }
    if (("pipe.txt".equals(documentId) || "s049-stream.pdf".equals(documentId)) && !mode.contains("w")) {
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
    boolean releaseCapture = "application/vnd.android.package-archive".equals(mimeType) && ("s048-installed-application.apk".equals(displayName) || "s048-installed-instrumentation.apk".equals(displayName));
    if (!ROOT_ID.equals(parentDocumentId) || !(releaseCapture || "text/plain".equals(mimeType) || "text/markdown".equals(mimeType) || "application/json".equals(mimeType) || "image/png".equals(mimeType) || "application/pdf".equals(mimeType))) {
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


  private boolean largeInitialized;
  private synchronized void ensureLargeFixture() {
    if (!largeInitialized) { initializeLargeFixture(fixtureDirectory()); largeInitialized = true; }
  }
  private static void initializeLargeFixture(File directory) {
    final byte[] line = "S047_LARGE_BODY\n".getBytes(StandardCharsets.UTF_8);
    final byte[] first = "S047_LARGE_FIRST\n".getBytes(StandardCharsets.UTF_8);
    final int length = 33 * 1024 * 1024;
    try {
      FixtureCanonicalFiles.initialize(new File(directory, "s047-large.txt"), () -> new java.io.InputStream() {
        private int position;
        @Override public int read() { if (position >= length) return -1; int at=position++; return (at < first.length ? first[at] : line[(at-first.length)%line.length]) & 255; }
        @Override public int read(byte[] buffer, int offset, int count) {
          if (count == 0) return 0;
          if (position >= length) return -1;
          int amount=Math.min(count,length-position);
          for (int index=0;index<amount;index++) buffer[offset+index]=(byte)read();
          return amount;
        }
      }, true);
    } catch (IOException error) { throw new IllegalStateException("large_fixture_initialization_failed", error); }
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
    if (!"s049-stream.pdf".equals(file.getName()) && !"unknown-size.txt".equals(file.getName())
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
    if (name.endsWith(".pdf")) return "application/pdf";
    if ("s048-installed-application.apk".equals(name) || "s048-installed-instrumentation.apk".equals(name)) return "application/vnd.android.package-archive";
    if (name.endsWith(".png")) return "image/png";
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
