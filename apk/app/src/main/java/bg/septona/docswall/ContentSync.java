package bg.septona.docswall;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * The single implementation of "check the server and pull down what changed".
 *
 * Called from two places:
 *   • MainActivity — every 5 minutes while the kiosk is running (the normal path).
 *   • SyncWorker   — every 15 minutes via WorkManager, as a backstop for when the
 *                    activity has been killed by the system.
 *
 * Cheap-poll design: the manifest request sends If-None-Match / If-Modified-Since.
 * When nothing changed the server answers 304 with no body, so a 5-minute poll
 * costs a few hundred bytes and no disk writes.
 *
 * Safety: nothing is touched on disk until a file has been downloaded AND its
 * SHA-256 verified. Any failure aborts the whole update and leaves the previous
 * snapshot fully intact, so the panel keeps displaying valid content.
 */
public final class ContentSync {

    private static final String TAG        = "ContentSync";
    private static final int    TIMEOUT_MS = 20_000;
    private static final String PREFS      = "sync";
    private static final String KEY_ETAG   = "etag";
    private static final String KEY_LASTMOD= "lastmod";
    private static final String KEY_LASTOK = "lastCheckOk";

    /** Guards against a WorkManager run and the 5-min poll overlapping. */
    private static final Object LOCK = new Object();

    public enum Outcome {
        UPDATED,     // new content applied → caller should reload the WebView
        UNCHANGED,   // already up to date (304 or same version)
        FAILED       // network/checksum problem; previous snapshot untouched
    }

    private ContentSync() {}

    public static Outcome sync(Context ctx) {
        synchronized (LOCK) {
            return doSync(ctx);
        }
    }

    private static Outcome doSync(Context ctx) {
        String origin = BuildConfig.SIGNAGE_ORIGIN;
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        try {
            // ---- 1. Conditional GET of the manifest -------------------------
            Http res = httpGet(origin + "/manifest.json",
                               sp.getString(KEY_ETAG, null),
                               sp.getString(KEY_LASTMOD, null));

            if (res == null) return Outcome.FAILED;

            if (res.code == 304) {
                sp.edit().putLong(KEY_LASTOK, System.currentTimeMillis()).apply();
                return Outcome.UNCHANGED;
            }
            if (res.body == null) return Outcome.FAILED;

            JSONObject remote = new JSONObject(new String(res.body, "UTF-8"));
            String remoteVersion = remote.optString("version", "");
            String localVersion  = ContentStore.currentVersion(ctx);

            if (remoteVersion.isEmpty()) {
                Log.w(TAG, "Manifest has no version field — ignoring");
                return Outcome.FAILED;
            }

            if (remoteVersion.equals(localVersion)) {
                // Remember the validators so the next poll can get a 304.
                saveValidators(sp, res);
                sp.edit().putLong(KEY_LASTOK, System.currentTimeMillis()).apply();
                return Outcome.UNCHANGED;
            }

            // ---- 2. Download every file whose hash differs -------------------
            Log.i(TAG, "Update available: " + localVersion + " → " + remoteVersion);
            JSONArray files = remote.getJSONArray("files");

            // Stage everything first; only commit once all downloads verified.
            java.util.List<Staged> staged = new java.util.ArrayList<>();

            for (int i = 0; i < files.length(); i++) {
                JSONObject f  = files.getJSONObject(i);
                String relPath  = f.getString("path");
                String remoteNm = f.optString("remote", relPath);
                String wantSha  = f.getString("sha256");

                File local = ContentStore.file(ctx, relPath);
                String haveSha = local.exists() ? sha256(local) : "";
                if (wantSha.equalsIgnoreCase(haveSha)) continue;   // already current

                String url = origin + "/" + remoteNm;
                Http dl = httpGet(url, null, null);
                if (dl == null || dl.body == null) {
                    Log.w(TAG, "Download failed: " + url + " — aborting, keeping previous snapshot");
                    return Outcome.FAILED;
                }
                String gotSha = sha256(dl.body);
                if (!wantSha.equalsIgnoreCase(gotSha)) {
                    Log.w(TAG, "Checksum mismatch: " + url
                             + "\n  expected " + wantSha + "\n  got      " + gotSha
                             + "\n  aborting, keeping previous snapshot");
                    return Outcome.FAILED;
                }
                staged.add(new Staged(relPath, dl.body));
                Log.i(TAG, "verified " + remoteNm + " → " + relPath + " (" + dl.body.length + " B)");
            }

            // ---- 3. Commit ---------------------------------------------------
            for (Staged s : staged) {
                ContentStore.writeAtomic(ctx, s.path, s.data);
            }
            ContentStore.writeAtomic(ctx, "manifest.json", res.body);
            ContentStore.setCurrentVersion(ctx, remoteVersion);
            saveValidators(sp, res);
            sp.edit().putLong(KEY_LASTOK, System.currentTimeMillis()).apply();

            Log.i(TAG, "Applied version " + remoteVersion + " · " + staged.size() + " file(s)");
            return staged.isEmpty() ? Outcome.UNCHANGED : Outcome.UPDATED;

        } catch (Exception e) {
            Log.w(TAG, "Sync error: " + e);
            return Outcome.FAILED;
        }
    }

    private static void saveValidators(SharedPreferences sp, Http res) {
        SharedPreferences.Editor e = sp.edit();
        if (res.etag    != null) e.putString(KEY_ETAG,    res.etag);
        if (res.lastMod != null) e.putString(KEY_LASTMOD, res.lastMod);
        e.apply();
    }

    /** Timestamp of the last successful check, for diagnostics. */
    public static long lastSuccessfulCheck(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_LASTOK, 0L);
    }

    // ---------------------------------------------------------------- helpers

    private static final class Staged {
        final String path; final byte[] data;
        Staged(String p, byte[] d) { path = p; data = d; }
    }

    private static final class Http {
        int code; byte[] body; String etag; String lastMod;
    }

    private static Http httpGet(String url, String etag, String lastMod) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(TIMEOUT_MS);
            c.setReadTimeout(TIMEOUT_MS);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("User-Agent", "iiyama-docs-wall/" + BuildConfig.VERSION_NAME);
            c.setRequestProperty("Accept-Encoding", "identity");
            if (etag    != null) c.setRequestProperty("If-None-Match",     etag);
            if (lastMod != null) c.setRequestProperty("If-Modified-Since", lastMod);

            Http r = new Http();
            r.code    = c.getResponseCode();
            r.etag    = c.getHeaderField("ETag");
            r.lastMod = c.getHeaderField("Last-Modified");

            if (r.code == HttpURLConnection.HTTP_NOT_MODIFIED) return r;   // 304, no body

            if (r.code < 200 || r.code >= 300) {
                Log.w(TAG, "HTTP " + r.code + " on " + url);
                return null;
            }
            try (InputStream in = c.getInputStream();
                 ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                r.body = out.toByteArray();
            }
            return r;
        } catch (Exception e) {
            Log.w(TAG, "GET failed " + url + " — " + e.getMessage());
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new java.io.FileInputStream(f)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
        }
        return hex(md.digest());
    }

    private static String sha256(byte[] d) throws Exception {
        return hex(MessageDigest.getInstance("SHA-256").digest(d));
    }

    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) sb.append(Character.forDigit((x >> 4) & 0xF, 16))
                           .append(Character.forDigit(x & 0xF, 16));
        return sb.toString();
    }
}
