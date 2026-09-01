package com.shruggietech.glitchpad.source

import app.tauri.annotation.InvokeArg

@InvokeArg
class DrainArgs {
  var maximum: Int = 16
}

@InvokeArg
class TokenArgs {
  lateinit var bridgeToken: String
}

@InvokeArg
class ReadArgs {
  lateinit var bridgeToken: String
  var offset: Long = 0
  var length: Long = 0
}

@InvokeArg
class OpenStreamArgs {
  lateinit var bridgeToken: String
  var offset: Long = 0
  var totalBudget: Long = 0
}

@InvokeArg
class ReadStreamArgs {
  lateinit var streamToken: String
  var length: Long = 0
}

@InvokeArg
class PickerArgs {
  var mediaType: String? = null
  var suggestedName: String? = null
  var bytes: IntArray? = null
}

internal enum class DeliveryKind(val wireName: String) {
  VIEW("view"),
  SHARE("share"),
  OPEN_RESULT("open_result"),
  CREATE_RESULT("create_result"),
}

internal data class DeliveryCandidate(
  val uri: android.net.Uri,
  val kind: DeliveryKind,
  val readOffered: Boolean,
  val writeOffered: Boolean,
  val persistenceOffered: Boolean,
)

internal data class NativeSource(
  val token: String,
  val uri: android.net.Uri,
  val kind: DeliveryKind,
  val readGranted: Boolean,
  val writeGranted: Boolean,
  val persistedRead: Boolean,
  val persistedWrite: Boolean,
)

internal data class NativeStream(
  val token: String,
  val sourceToken: String,
  val descriptor: android.os.ParcelFileDescriptor,
  val input: java.io.FileInputStream,
  var remaining: Long,
) : java.io.Closeable {
  override fun close() {
    runCatching(input::close)
    runCatching(descriptor::close)
  }
}
