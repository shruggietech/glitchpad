package com.shruggietech.glitchpad.source;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

final class FixtureCanonicalFiles {
  @FunctionalInterface
  interface Source { InputStream open() throws IOException; }

  private FixtureCanonicalFiles() {}

  static boolean initialize(File file, Source source, boolean sync) throws IOException {
    if (matches(file, source)) return false;
    try (InputStream input = source.open(); FileOutputStream output = new FileOutputStream(file, false)) {
      byte[] buffer = new byte[4096];
      int count;
      while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
      if (sync) output.getFD().sync();
    }
    return true;
  }

  private static boolean matches(File file, Source source) throws IOException {
    if (!file.isFile()) return false;
    try (InputStream current = new BufferedInputStream(new FileInputStream(file));
        InputStream expected = new BufferedInputStream(source.open())) {
      int next;
      while ((next = expected.read()) != -1) {
        if (current.read() != next) return false;
      }
      return current.read() == -1;
    }
  }
}
