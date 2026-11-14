package com.example

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
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
import java.io.ByteArrayInputStream
import java.io.IOException

class MainActivity : ComponentActivity() {
  private var gameWebView: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    configureImmersiveMode()

    if (BuildConfig.DEBUG) {
      WebView.setWebContentsDebuggingEnabled(true)
    }

    setContent {
      Box(
        modifier = Modifier
          .fillMaxSize()
          .background(ComposeColor(0xFF0B0914))
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
      setBackgroundColor(Color.parseColor("#0B0914"))
      // Use default LAYER_TYPE_NONE so Chromium's GPU/WebGL Surface composites natively
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
        cacheMode = WebSettings.LOAD_NO_CACHE
        setSupportZoom(false)
        builtInZoomControls = false
        displayZoomControls = false
      }

      clearCache(true)

      webChromeClient = object : WebChromeClient() {
        override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
          if (consoleMessage != null) {
            Log.d(
              "ImmortalHandWV",
              "[${consoleMessage.messageLevel()}] ${consoleMessage.message()} (${consoleMessage.sourceId()}:${consoleMessage.lineNumber()})"
            )
          }
          return true
        }
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
              mapOf(
                "Access-Control-Allow-Origin" to "*",
                "Cache-Control" to "no-store"
              ),
              stream
            )
          } catch (_: IOException) {
            WebResourceResponse(
              "text/plain",
              "UTF-8",
              404,
              "Not Found",
              mapOf("Access-Control-Allow-Origin" to "*"),
              ByteArrayInputStream(ByteArray(0))
            )
          }
        }

        override fun onReceivedError(
          view: WebView?,
          request: WebResourceRequest?,
          error: WebResourceError?
        ) {
          Log.e(
            "ImmortalHandWV",
            "WebView error ${error?.errorCode}: ${error?.description} for ${request?.url}"
          )
        }

        override fun onRenderProcessGone(
          view: WebView?,
          detail: RenderProcessGoneDetail?
        ): Boolean {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Log.e("ImmortalHandWV", "RenderProcessGone didCrash=${detail?.didCrash()}")
          }
          view?.loadUrl("https://appassets.androidplatform.net/index.html")
          return true
        }
      }

      onWebViewReady(this)
    }
  }

  DisposableEffect(webView) {
    onDispose {
      webView.destroy()
    }
  }

  AndroidView(
    factory = {
      if (webView.url == null) {
        webView.loadUrl("https://appassets.androidplatform.net/index.html")
      }
      webView
    },
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
