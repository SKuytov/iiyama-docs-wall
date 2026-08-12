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

    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Runnable heartbeat = new Runnable() {
        @Override public void run() {
            getSharedPreferences("hb", MODE_PRIVATE).edit()
                .putLong("t", System.currentTimeMillis()).apply();
            ui.postDelayed(this, 60_000);
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
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        WebView.setWebContentsDebuggingEnabled(false);

        web.setBackgroundColor(0xFF000000);
        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(false);
        web.setOnLongClickListener(v -> true);

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
    }

    private void loadLocalIndex() {
        File index = ContentStore.file(this, "index.html");
        if (index.exists() && index.length() > 0) {
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
        try { unregisterReceiver(reloadReceiver); } catch (Exception ignored) {}
        ui.removeCallbacks(heartbeat);
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
