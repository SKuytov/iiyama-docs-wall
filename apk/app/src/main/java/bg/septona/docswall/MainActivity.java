package bg.septona.docswall;

import android.annotation.SuppressLint;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

import java.io.File;
import java.io.FileInputStream;

/**
 * The kiosk activity.
 *
 *   • Loads file:///data/data/…/files/web/index.html   (always local → always works)
 *   • Immersive fullscreen, keep screen on, no back button.
 *   • Emits a heartbeat every 60 s so the WatchdogWorker knows we're alive.
 *   • Listens for RELOAD_ACTION broadcast from SyncWorker after content updates.
 *   • On any render error, retries after 5 s.
 */
public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";
    public  static final String RELOAD_ACTION = "bg.septona.docswall.RELOAD";

    /** How often the running kiosk checks the server for new content. */
    private static final long POLL_INTERVAL_MS = 5 * 60 * 1000L;   // 5 minutes
    /** First check happens shortly after launch so a fresh install updates fast. */
    private static final long POLL_FIRST_DELAY_MS = 20 * 1000L;    // 20 seconds

    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());

    /** Single background thread for network polling — never touches the UI thread. */
    private java.util.concurrent.ExecutorService netPool;

    private final Runnable heartbeat = new Runnable() {
        @Override public void run() {
            getSharedPreferences("hb", MODE_PRIVATE).edit()
                .putLong("t", System.currentTimeMillis()).apply();
            ui.postDelayed(this, 60_000);
        }
    };

    /**
     * The 5-minute content poller.
     *
     * Runs the actual HTTP work on {@link #netPool}; re-arms itself on the UI thread
     * regardless of the outcome, so a temporary network outage never stops polling.
     * The manifest request is conditional (ETag / If-Modified-Since), so an
     * unchanged server answers 304 and this costs almost nothing.
     */
    private final Runnable poller = new Runnable() {
        @Override public void run() {
            if (netPool != null && !netPool.isShutdown()) {
                netPool.execute(() -> {
                    ContentSync.Outcome out = ContentSync.sync(MainActivity.this);
                    Log.i(TAG, "5-min poll → " + out);
                    // Publish status so the ?diag=1 overlay in the page can display it.
                    getSharedPreferences("hb", MODE_PRIVATE).edit()
                        .putString("lastPoll", out.name())
                        .putLong("lastPollAt", System.currentTimeMillis())
                        .apply();
                    if (out == ContentSync.Outcome.UPDATED) {
                        ui.post(MainActivity.this::loadLocalIndex);
                    }
                });
            }
            ui.postDelayed(this, POLL_INTERVAL_MS);
        }
    };

    private final BroadcastReceiver reloadReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            Log.i(TAG, "RELOAD broadcast received");
            loadLocalIndex();
        }
    };

    /** Called from SyncWorker after fresh content is written. */
    public static void requestReload(Context ctx) {
        Intent i = new Intent(RELOAD_ACTION).setPackage(ctx.getPackageName());
        ctx.sendBroadcast(i);
    }

    @SuppressLint({"SetJavaScriptEnabled"})
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);

        // Always-on display
        getWindow().addFlags(
              WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        // The page declares width=device-width, so we must NOT let the WebView
        // impose its own wide viewport / overview zoom. Both of those combined with
        // a fixed-width viewport tag are what caused the top-left crop.
        s.setUseWideViewPort(false);
        s.setLoadWithOverviewMode(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);                       // ignore any system font-scale setting
        s.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);
        s.setMediaPlaybackRequiresUserGesture(false);
        // No caching layer needed — all content is read from local storage.
        // This is what makes an updated file take effect immediately on reload.
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        WebView.setWebContentsDebuggingEnabled(false);

        web.setInitialScale(100);                 // force 1:1, no auto-fit guessing
        web.setBackgroundColor(0xFF000000);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setScrollBarStyle(android.view.View.SCROLLBARS_INSIDE_OVERLAY);
        web.setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);
        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(false);
        web.setOnLongClickListener(v -> true);

        // Expose the native sync status to the page so ?diag=1 can show it.
        web.addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public String status() {
                android.content.SharedPreferences p = getSharedPreferences("hb", MODE_PRIVATE);
                long at = p.getLong("lastPollAt", 0L);
                String ago = at == 0 ? "never"
                        : ((System.currentTimeMillis() - at) / 1000) + "s ago";
                return "version=" + ContentStore.currentVersion(MainActivity.this)
                     + "  lastPoll=" + p.getString("lastPoll", "-")
                     + " (" + ago + ")"
                     + "  every=" + (POLL_INTERVAL_MS / 60000) + "min"
                     + "  origin=" + BuildConfig.SIGNAGE_ORIGIN;
            }
        }, "DocsWall");

        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView v, String url, Bitmap fav) {
                Log.i(TAG, "onPageStarted " + url);
            }
            @Override public void onPageFinished(WebView v, String url) {
                Log.i(TAG, "onPageFinished " + url);
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest req,
                                                  android.webkit.WebResourceError err) {
                if (req == null || req.isForMainFrame()) {
                    Log.w(TAG, "Render error, retrying in 5 s");
                    ui.postDelayed(MainActivity.this::loadLocalIndex, 5_000);
                }
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                // Everything we care about is on file:// → let default handling run
                return super.shouldInterceptRequest(v, req);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i("Web", m.messageLevel() + " " + m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });

        registerReceiver(reloadReceiver, new IntentFilter(RELOAD_ACTION),
            android.os.Build.VERSION.SDK_INT >= 33 ? Context.RECEIVER_NOT_EXPORTED : 0);

        heartbeat.run();
        loadLocalIndex();

        // Start the 5-minute content poller.
        netPool = java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "content-poll");
            t.setDaemon(true);
            return t;
        });
        ui.postDelayed(poller, POLL_FIRST_DELAY_MS);
    }

    private void loadLocalIndex() {
        File index = ContentStore.file(this, "index.html");
        if (index.exists() && index.length() > 0) {
            // Content lives on local disk and the paths never change, so the WebView
            // could otherwise re-serve a stale style.css / app.js / board.jpg from its
            // own cache after an update. Clearing it before each load is cheap here
            // (everything is a local file read) and guarantees a real refresh.
            // NOTE: a "?v=" cache-buster would not help — relative sub-resources resolve
            // without the query string, so their cached copies would still be used.
            web.clearCache(true);
            web.loadUrl("file://" + index.getAbsolutePath());
        } else {
            // Should not happen (App.onCreate provisions the bundle) but never leave the screen blank.
            String html = "<html><body style='background:#0e1420;color:#e6ecf5;"
                        + "font-family:sans-serif;display:flex;align-items:center;"
                        + "justify-content:center;height:100vh;font-size:44px'>"
                        + "Подготовка на съдържанието…"
                        + "</body></html>";
            web.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            ui.postDelayed(this::loadLocalIndex, 5_000);
        }
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Cold-restart signal from Watchdog: force reload
        loadLocalIndex();
    }

    @Override public void onWindowFocusChanged(boolean has) {
        super.onWindowFocusChanged(has);
        if (has) enterImmersive();
    }

    private void enterImmersive() {
        View d = getWindow().getDecorView();
        d.setSystemUiVisibility(
              View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
    }

    // Kiosk: swallow back / menu / recents / volume
    @Override public void onBackPressed() { /* no-op */ }
    @Override public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        if (k == KeyEvent.KEYCODE_BACK
         || k == KeyEvent.KEYCODE_MENU
         || k == KeyEvent.KEYCODE_HOME
         || k == KeyEvent.KEYCODE_APP_SWITCH) return true;
        return super.dispatchKeyEvent(e);
    }

    @Override protected void onDestroy() {
        ui.removeCallbacks(poller);
        if (netPool != null) netPool.shutdownNow();
        try { unregisterReceiver(reloadReceiver); } catch (Exception ignored) {}
        ui.removeCallbacks(heartbeat);
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
