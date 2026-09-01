package com.shruggietech.glitchpad.source

import android.content.Intent
import android.net.Uri

internal object DeliveryPolicy {
  private const val GRANT_READ = Intent.FLAG_GRANT_READ_URI_PERMISSION
  private const val GRANT_WRITE = Intent.FLAG_GRANT_WRITE_URI_PERMISSION
  private const val GRANT_PERSIST = Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION

  fun inbound(intent: Intent?): Result<DeliveryCandidate> {
    if (intent == null) return Result.failure(IllegalArgumentException("missing_delivery"))
    val kind = when (intent.action) {
      Intent.ACTION_VIEW -> DeliveryKind.VIEW
      Intent.ACTION_SEND -> DeliveryKind.SHARE
      else -> return Result.failure(IllegalArgumentException("unsupported_action"))
    }
    val uris = when (kind) {
      DeliveryKind.VIEW -> listOfNotNull(intent.data)
      DeliveryKind.SHARE -> shareUris(intent)
      else -> emptyList()
    }.distinctBy(Uri::toString)
    if (uris.size != 1 || uris.single().scheme != "content") {
      return Result.failure(IllegalArgumentException("invalid_source_shape"))
    }
    val flags = intent.flags
    if (flags and GRANT_READ == 0) {
      return Result.failure(SecurityException("read_authority_required"))
    }
    return Result.success(
      DeliveryCandidate(
        uri = uris.single(),
        kind = kind,
        readOffered = true,
        writeOffered = flags and GRANT_WRITE != 0,
        persistenceOffered = false,
      ),
    )
  }

  fun pickerResult(intent: Intent?, kind: DeliveryKind): Result<DeliveryCandidate> {
    require(kind == DeliveryKind.OPEN_RESULT || kind == DeliveryKind.CREATE_RESULT)
    val uri = intent?.data
      ?: return Result.failure(IllegalArgumentException("missing_picker_source"))
    if (uri.scheme != "content") {
      return Result.failure(IllegalArgumentException("invalid_source_scheme"))
    }
    val flags = intent.flags
    if (flags and GRANT_READ == 0 && kind == DeliveryKind.OPEN_RESULT) {
      return Result.failure(SecurityException("read_authority_required"))
    }
    return Result.success(
      DeliveryCandidate(
        uri = uri,
        kind = kind,
        readOffered = flags and GRANT_READ != 0 || kind == DeliveryKind.CREATE_RESULT,
        writeOffered = flags and GRANT_WRITE != 0 || kind == DeliveryKind.CREATE_RESULT,
        persistenceOffered = flags and GRANT_PERSIST != 0,
      ),
    )
  }

  fun persistableModes(candidate: DeliveryCandidate): Int {
    if (!candidate.persistenceOffered ||
      (candidate.kind != DeliveryKind.OPEN_RESULT && candidate.kind != DeliveryKind.CREATE_RESULT)
    ) return 0
    var modes = 0
    if (candidate.readOffered) modes = modes or GRANT_READ
    if (candidate.writeOffered) modes = modes or GRANT_WRITE
    return modes
  }

  @Suppress("DEPRECATION")
  private fun shareUris(intent: Intent): List<Uri> {
    val values = mutableListOf<Uri>()
    intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)?.let(values::add)
    intent.clipData?.let { clip ->
      for (index in 0 until clip.itemCount) clip.getItemAt(index).uri?.let(values::add)
    }
    return values
  }
}
