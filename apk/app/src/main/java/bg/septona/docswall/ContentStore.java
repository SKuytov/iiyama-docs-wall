package bg.septona.docswall;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Manages the local snapshot of the web app.
 *
 *   filesDir/
 *      web/
 *         index.html
 *         style.css
 *         app.js
 *         assets/
 *            board.jpg
 *            cotton-bg-1.jpg
 *            cotton-bg-2.jpg
 *            septona-logo.png
 *         manifest.json     (last-known-good)
 *
 * On first launch the folder is missing → we copy the bundled snapshot from
 * `assets/web/`.  Afterwards `SyncWorker` diffs the remote manifest and
 * atomically replaces changed files.
 */
public class ContentStore {

    private static final String TAG = "ContentStore";
    private static final String PREFS = "content";
    private static final String KEY_VERSION = "version";

    public static File webRoot(Context ctx) {
        return new File(ctx.getFilesDir(), "web");
    }

    public static File file(Context ctx, String relPath) {
        return new File(webRoot(ctx), relPath);
    }

    public static String indexUrl(Context ctx) {
        return "file://" + file(ctx, "index.html").getAbsolutePath();
    }

    public static String currentVersion(Context ctx) {
        return prefs(ctx).getString(KEY_VERSION, "bundled");
    }

    public static void setCurrentVersion(Context ctx, String v) {
        prefs(ctx).edit().putString(KEY_VERSION, v).apply();
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Called on Application.onCreate — makes sure a usable snapshot exists. */
    public static synchronized void ensureBundle(Context ctx) throws Exception {
        File root = webRoot(ctx);
        File index = new File(root, "index.html");
        if (index.exists() && index.length() > 0) return;   // already provisioned

        Log.i(TAG, "Provisioning offline snapshot from APK assets…");
        if (!root.exists() && !root.mkdirs()) {
            throw new IllegalStateException("Cannot create " + root);
        }
        copyAssetTree(ctx, "web", root);
        Log.i(TAG, "Snapshot ready at " + root);
    }

    /** Recursively copies `assetPath` (inside the APK) into `dst` (in filesDir). */
    private static void copyAssetTree(Context ctx, String assetPath, File dst) throws Exception {
        String[] entries = ctx.getAssets().list(assetPath);
        if (entries == null || entries.length == 0) {
            // It's a file: copy it
            try (InputStream in = ctx.getAssets().open(assetPath);
                 OutputStream out = new FileOutputStream(dst)) {
                byte[] buf = new byte[64 * 1024];
                int r;
                while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
            }
            return;
        }
        // Directory
        if (!dst.exists() && !dst.mkdirs()) throw new IllegalStateException("mkdir " + dst);
        for (String name : entries) {
            copyAssetTree(ctx, assetPath + "/" + name, new File(dst, name));
        }
    }

    /** Atomically write bytes into `filesDir/web/<relPath>`. */
    public static void writeAtomic(Context ctx, String relPath, byte[] data) throws Exception {
        File target = file(ctx, relPath);
        File parent = target.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IllegalStateException("mkdir " + parent);
        }
        File tmp = new File(target.getAbsolutePath() + ".part");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(data);
            out.getFD().sync();
        }
        if (target.exists() && !target.delete()) {
            Log.w(TAG, "Could not delete previous " + target);
        }
        if (!tmp.renameTo(target)) {
            throw new IllegalStateException("rename " + tmp + " → " + target);
        }
    }
}
