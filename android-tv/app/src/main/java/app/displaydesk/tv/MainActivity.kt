package app.displaydesk.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast

/**
 * Full-screen kiosk around the existing web player. First launch shows the
 * web app's own PIN keypad (/tv); once it navigates to /tv/<pin> the PIN is
 * remembered and every later launch opens that screen directly.
 *
 * Hold Back for 5 seconds to forget the PIN and return to the keypad.
 */
class MainActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private val prefs by lazy { getSharedPreferences("displaydesk", MODE_PRIVATE) }
    private var webView: WebView? = null
    private var backDownAt = 0L
    private var resetHandled = false

    private val pinPath = Regex("""^/tv/([0-9]{4})/?$""")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        createWebView()
        loadStart()
    }

    private fun startUrl(): String {
        val pin = prefs.getString(KEY_PIN, null)
        return if (pin != null) "${BuildConfig.BASE_URL}/tv/$pin" else "${BuildConfig.BASE_URL}/tv"
    }

    private fun loadStart() {
        webView?.loadUrl(startUrl())
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView() {
        webView?.let { (it.parent as? ViewGroup)?.removeView(it); it.destroy() }

        val view = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }
            webViewClient = PlayerClient()
        }
        webView = view
        setContentView(view)
        view.requestFocus()
    }

    private inner class PlayerClient : WebViewClient() {
        override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
            val path = url?.let { Uri.parse(it).path } ?: return
            pinPath.find(path)?.let { prefs.edit().putString(KEY_PIN, it.groupValues[1]).apply() }
        }

        // No network at launch: keep retrying; the service worker serves the
        // cached page as soon as one load has succeeded before.
        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) handler.postDelayed({ view.loadUrl(startUrl()) }, RETRY_MS)
        }

        // The WebView renderer can be killed under memory pressure; rebuild it
        // instead of crashing the whole app to a black screen.
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            handler.post { createWebView(); loadStart() }
            return true
        }
    }

    private fun resetPairing() {
        prefs.edit().remove(KEY_PIN).apply()
        WebStorage.getInstance().deleteAllData()
        webView?.clearCache(true)
        Toast.makeText(this, "Pairing reset", Toast.LENGTH_SHORT).show()
        loadStart()
    }

    // Back never exits the kiosk; holding it for 5s resets the pairing.
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.repeatCount == 0) { backDownAt = event.eventTime; resetHandled = false }
            else if (!resetHandled && event.eventTime - backDownAt >= RESET_HOLD_MS) {
                resetHandled = true
                resetPairing()
            }
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean =
        if (keyCode == KeyEvent.KEYCODE_BACK) true else super.onKeyUp(keyCode, event)

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY)
        }
    }

    override fun onResume() { super.onResume(); webView?.onResume() }
    override fun onPause() { webView?.onPause(); super.onPause() }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        webView?.destroy()
        super.onDestroy()
    }

    companion object {
        private const val KEY_PIN = "pin"
        private const val RETRY_MS = 10_000L
        private const val RESET_HOLD_MS = 5_000L
    }
}
