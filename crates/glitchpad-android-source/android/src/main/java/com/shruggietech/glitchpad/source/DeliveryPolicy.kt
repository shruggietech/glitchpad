package com.shruggietech.glitchpad.source

import android.content.Intent
import android.net.Uri

internal object DeliveryPolicy {
  fun inbound(intent: Intent?): Result<DeliveryCandidate> {
    val uris = when (intent?.action) {
      Intent.ACTION_VIEW -> listOfNotNull(intent.data)
      Intent.ACTION_SEND -> shareUris(intent)
      else -> emptyList()
    }
    return DeliveryRules.inbound(intent?.action, uris.map(Uri::toString), intent?.flags ?: 0)
      .map(::toCandidate)
  }

  fun pickerResult(intent: Intent?, kind: DeliveryKind): Result<DeliveryCandidate> {
    return DeliveryRules.pickerResult(intent?.data?.toString(), kind, intent?.flags ?: 0)
      .map(::toCandidate)
  }

  fun persistableModes(candidate: DeliveryCandidate): Int {
    return DeliveryRules.persistableModes(candidate.toNormalized())
  }

  private fun toCandidate(candidate: NormalizedDelivery) = DeliveryCandidate(
    uri = Uri.parse(candidate.uri),
    kind = candidate.kind,
    readOffered = candidate.readOffered,
    writeOffered = candidate.writeOffered,
    persistenceOffered = candidate.persistenceOffered,
  )

  private fun DeliveryCandidate.toNormalized() = NormalizedDelivery(
    uri = uri.toString(),
    kind = kind,
    readOffered = readOffered,
    writeOffered = writeOffered,
    persistenceOffered = persistenceOffered,
  )

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

internal data class NormalizedDelivery(
  val uri: String,
  val kind: DeliveryKind,
  val readOffered: Boolean,
  val writeOffered: Boolean,
  val persistenceOffered: Boolean,
)

internal object DeliveryRules {
  const val ACTION_VIEW = "android.intent.action.VIEW"
  const val ACTION_SEND = "android.intent.action.SEND"
  const val GRANT_READ = 0x00000001
  const val GRANT_WRITE = 0x00000002
  const val GRANT_PERSIST = 0x00000040

  fun inbound(action: String?, uris: List<String>, flags: Int): Result<NormalizedDelivery> {
    if (action == null) return Result.failure(IllegalArgumentException("missing_delivery"))
    val kind = when (action) {
      ACTION_VIEW -> DeliveryKind.VIEW
      ACTION_SEND -> DeliveryKind.SHARE
      else -> return Result.failure(IllegalArgumentException("unsupported_action"))
    }
    val distinctUris = uris.distinct()
    if (distinctUris.size != 1 || !isContentUri(distinctUris.single())) {
      return Result.failure(IllegalArgumentException("invalid_source_shape"))
    }
    if (flags and GRANT_READ == 0) {
      return Result.failure(SecurityException("read_authority_required"))
    }
    return Result.success(
      NormalizedDelivery(
        uri = distinctUris.single(),
        kind = kind,
        readOffered = true,
        writeOffered = flags and GRANT_WRITE != 0,
        persistenceOffered = false,
      ),
    )
  }

  fun pickerResult(uri: String?, kind: DeliveryKind, flags: Int): Result<NormalizedDelivery> {
    require(kind == DeliveryKind.OPEN_RESULT || kind == DeliveryKind.CREATE_RESULT)
    if (uri == null) return Result.failure(IllegalArgumentException("missing_picker_source"))
    if (!isContentUri(uri)) {
      return Result.failure(IllegalArgumentException("invalid_source_scheme"))
    }
    if (flags and GRANT_READ == 0 && kind == DeliveryKind.OPEN_RESULT) {
      return Result.failure(SecurityException("read_authority_required"))
    }
    return Result.success(
      NormalizedDelivery(
        uri = uri,
        kind = kind,
        readOffered = flags and GRANT_READ != 0 || kind == DeliveryKind.CREATE_RESULT,
        writeOffered = flags and GRANT_WRITE != 0 || kind == DeliveryKind.CREATE_RESULT,
        persistenceOffered = flags and GRANT_PERSIST != 0,
      ),
    )
  }

  fun persistableModes(candidate: NormalizedDelivery): Int {
    if (!candidate.persistenceOffered ||
      (candidate.kind != DeliveryKind.OPEN_RESULT && candidate.kind != DeliveryKind.CREATE_RESULT)
    ) return 0
    var modes = 0
    if (candidate.readOffered) modes = modes or GRANT_READ
    if (candidate.writeOffered) modes = modes or GRANT_WRITE
    return modes
  }

  private fun isContentUri(uri: String) = uri.substringBefore(':') == "content"
}
