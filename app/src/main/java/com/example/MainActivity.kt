package com.example

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color as ComposeColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.io.IOException

class MainActivity : ComponentActivity() {
  private var gameWebView: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    configureImmersiveMode()

    setContent {
      Box(
        modifier = Modifier
          .fillMaxSize()
          .background(ComposeColor(0xFF070B14))
      ) {
        GameWebView(
          onWebViewReady = { webView -> gameWebView = webView },
          onBack = {
            val wv = gameWebView
            if (wv != null) {
              wv.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('android-back'));",
                null
              )
            } else {
              finish()
            }
          }
        )
      }
    }
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      configureImmersiveMode()
    }
  }

  override fun onPause() {
    super.onPause()
    gameWebView?.onPause()
  }

  override fun onResume() {
    super.onResume()
    gameWebView?.onResume()
  }

  private fun configureImmersiveMode() {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    controller.hide(WindowInsetsCompat.Type.systemBars())
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun GameWebView(
  onWebViewReady: (WebView) -> Unit,
  onBack: () -> Unit,
) {
  val context = LocalContext.current

  BackHandler(enabled = true) {
    onBack()
  }

  val webView = remember {
    WebView(context).apply {
      layoutParams = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
      setBackgroundColor(Color.parseColor("#070B14"))
      setLayerType(View.LAYER_TYPE_HARDWARE, null)
      isFocusable = true
      isFocusableInTouchMode = true
      overScrollMode = View.OVER_SCROLL_NEVER

      settings.apply {
        javaScriptEnabled = true
        domStorageEnabled = true
        databaseEnabled = true
        mediaPlaybackRequiresUserGesture = false
        allowFileAccess = true
        useWideViewPort = true
        loadWithOverviewMode = true
        cacheMode = WebSettings.LOAD_DEFAULT
        setSupportZoom(false)
        builtInZoomControls = false
        displayZoomControls = false
      }

      webViewClient = object : WebViewClient() {
        override fun shouldInterceptRequest(
          view: WebView?,
          request: WebResourceRequest?
        ): WebResourceResponse? {
          val url = request?.url ?: return null
          if (url.host != "appassets.androidplatform.net") return null
          var assetPath = url.path?.removePrefix("/") ?: "index.html"
          if (assetPath.isEmpty()) assetPath = "index.html"
          val fullAssetPath = "public/$assetPath"
          return try {
            val stream = context.assets.open(fullAssetPath)
            val mimeType = resolveMimeType(assetPath)
            WebResourceResponse(
              mimeType,
              "UTF-8",
              200,
              "OK",
              mapOf("Access-Control-Allow-Origin" to "*"),
              stream
            )
          } catch (_: IOException) {
            null
          }
        }
      }

      loadUrl("https://appassets.androidplatform.net/index.html")
      onWebViewReady(this)
    }
  }

  DisposableEffect(webView) {
    onDispose {
      webView.destroy()
    }
  }

  AndroidView(
    factory = { webView },
    modifier = Modifier.fillMaxSize()
  )
}

private fun resolveMimeType(path: String): String {
  val lower = path.lowercase()
  return when {
    lower.endsWith(".html") -> "text/html"
    lower.endsWith(".js") || lower.endsWith(".mjs") -> "application/javascript"
    lower.endsWith(".css") -> "text/css"
    lower.endsWith(".json") -> "application/json"
    lower.endsWith(".svg") -> "image/svg+xml"
    lower.endsWith(".png") -> "image/png"
    lower.endsWith(".jpg") || lower.endsWith(".jpeg") -> "image/jpeg"
    lower.endsWith(".webp") -> "image/webp"
    lower.endsWith(".woff2") -> "font/woff2"
    lower.endsWith(".wasm") -> "application/wasm"
    else -> "application/octet-stream"
  }
}
