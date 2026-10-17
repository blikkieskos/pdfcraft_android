package com.pdfcraft.app

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.provider.Settings
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject
import java.io.File
import java.util.Locale

class MainActivity : TauriActivity() {
  private var webView: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Edge-to-edge draws the app under the status bar, navigation bar, display cutout and
    // keyboard. Pad the content so the web UI stays clear of them; the padding shows the
    // window background, which matches the app's light/dark background (see themes.xml).
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
      view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, keyboard.bottom))
      WindowInsetsCompat.CONSUMED
    }

    // Launched through "Open with" / "Share" (a fresh start, not a rotation or restore)
    if (savedInstanceState == null) {
      receivePdf(intent)
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    this.webView = webView
    webView.addJavascriptInterface(DefaultPdfAppBridge(), "PdfCraftAndroid")
  }

  /**
   * Lets the web UI (src/lib/app/default-pdf-app.ts) check and set up PDFCraft as the
   * phone's default PDF app. Android never lets an app make itself the default: the user
   * picks "Always" in the system's "Open with" sheet, which only appears when no other app
   * holds the default.
   */
  private inner class DefaultPdfAppBridge {
    /** {"status":"self"|"none"} or {"status":"other","app":"<label>"} */
    @JavascriptInterface
    fun getDefaultPdfApp(): String = defaultPdfAppStatus().first.toString()

    /**
     * No default yet: opens a sample PDF so the system shows "Open with" (PDFCraft → Always).
     * Another app is the default: opens that app's settings to clear it ("Open by default").
     */
    @JavascriptInterface
    fun setUpDefaultPdfApp(): String {
      val (status, holder) = defaultPdfAppStatus()
      runOnUiThread {
        try {
          when (status.getString("status")) {
            "none" -> startActivity(sampleViewIntent())
            "other" -> startActivity(
              Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", holder, null))
            )
          }
        } catch (e: Exception) {
          Log.e("PDFCraft", "Could not start default PDF app setup", e)
        }
      }
      return status.toString()
    }
  }

  /** The status JSON plus the package name that currently holds the default, if any */
  private fun defaultPdfAppStatus(): Pair<JSONObject, String?> {
    val resolved = packageManager.resolveActivity(sampleViewIntent(), PackageManager.MATCH_DEFAULT_ONLY)
    val activity = resolved?.activityInfo ?: return JSONObject().put("status", "none") to null
    return when {
      activity.packageName == packageName -> JSONObject().put("status", "self") to null
      // Several apps and no default: Android would ask, via its own chooser
      activity.packageName == "android" || activity.name.contains("ResolverActivity") ->
        JSONObject().put("status", "none") to null
      else -> JSONObject()
        .put("status", "other")
        .put("app", resolved.loadLabel(packageManager).toString()) to activity.packageName
    }
  }

  /** "View" intent for a tiny PDF in the cache, shared through the app's FileProvider */
  private fun sampleViewIntent(): Intent {
    val sample = File(File(cacheDir, "default-check").apply { mkdirs() }, "PDFCraft.pdf")
    if (!sample.exists()) sample.writeBytes(minimalPdf())
    val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", sample)
    return Intent(Intent.ACTION_VIEW)
      .setDataAndType(uri, "application/pdf")
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
  }

  /** A valid one-page blank PDF (ASCII only, so string offsets are byte offsets) */
  private fun minimalPdf(): ByteArray {
    val objects = listOf(
      "<</Type/Catalog/Pages 2 0 R>>",
      "<</Type/Pages/Kids[3 0 R]/Count 1>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>"
    )
    val pdf = StringBuilder("%PDF-1.4\n")
    val offsets = objects.mapIndexed { index, body ->
      val offset = pdf.length
      pdf.append("${index + 1} 0 obj\n$body\nendobj\n")
      offset
    }
    val xref = pdf.length
    pdf.append("xref\n0 ${objects.size + 1}\n0000000000 65535 f \n")
    offsets.forEach { pdf.append(String.format(Locale.ROOT, "%010d 00000 n \n", it)) }
    pdf.append("trailer\n<</Size ${objects.size + 1}/Root 1 0 R>>\nstartxref\n$xref\n%%EOF\n")
    return pdf.toString().toByteArray(Charsets.US_ASCII)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    receivePdf(intent)
  }

  /**
   * Copies a PDF handed over by another app into <cache>/incoming and writes pending.json.
   * The web UI reads both through the pdfcraft-incoming protocol (see src-tauri/src/lib.rs)
   * on start-up, and right away when it is already running.
   */
  private fun receivePdf(intent: Intent?) {
    val uri: Uri = when (intent?.action) {
      Intent.ACTION_VIEW -> intent.data
      Intent.ACTION_SEND ->
        if (Build.VERSION.SDK_INT >= 33) {
          intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
          @Suppress("DEPRECATION")
          intent.getParcelableExtra(Intent.EXTRA_STREAM)
        }
      else -> null
    } ?: return

    // The sample from "Set as default" coming back means PDFCraft was picked: nothing to open
    if (uri.authority == "$packageName.fileprovider") {
      webView?.evaluateJavascript("window.dispatchEvent(new Event('pdfcraft-default-changed'))", null)
      return
    }

    Thread {
      try {
        val dir = File(cacheDir, "incoming").apply { mkdirs() }
        // Only the latest document is kept; the web UI copies it into memory when it opens it
        dir.listFiles()?.forEach { it.delete() }

        val displayName = queryDisplayName(uri) ?: "document.pdf"
        // A plain file name keeps the URL simple and can't escape the folder
        val fileName = displayName.replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "document.pdf" }
        contentResolver.openInputStream(uri)?.use { input ->
          File(dir, fileName).outputStream().use { output -> input.copyTo(output) }
        } ?: return@Thread

        val pending = JSONObject().put("file", fileName).put("name", displayName)
        File(dir, "pending.json").writeText(pending.toString())

        runOnUiThread {
          webView?.evaluateJavascript("window.dispatchEvent(new Event('pdfcraft-incoming-file'))", null)
        }
      } catch (e: Exception) {
        Log.e("PDFCraft", "Could not receive PDF from $uri", e)
      }
    }.start()
  }

  private fun queryDisplayName(uri: Uri): String? {
    if (uri.scheme == "file") return uri.lastPathSegment
    return try {
      contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else null
      }
    } catch (e: Exception) {
      null
    }
  }
}
