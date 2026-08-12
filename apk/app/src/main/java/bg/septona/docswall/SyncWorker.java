package bg.septona.docswall;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Periodic sync worker.
 *
 * 1. GET  {SIGNAGE_ORIGIN}/manifest.json
 * 2. Compare `version` with locally stored one.
 * 3. If different, for each entry whose sha256 differs from the on-disk file:
 *       download {SIGNAGE_ORIGIN}/<remote>  → write atomically to <path>.
 *       (`remote` defaults to `path` when not present in the manifest entry.)
 * 4. Save new manifest + version.
 * 5. Nudge MainActivity to reload.
 *
 * On any failure the previous snapshot is untouched → the screen keeps working.
 */
public class SyncWorker extends Worker {

    private static final String TAG = "SyncWorker";
    private static final int    TIMEOUT_MS = 20_000;

    public SyncWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    @NonNull @Override public Result doWork() {
        Context ctx = getApplicationContext();
        String origin = BuildConfig.SIGNAGE_ORIGIN;
        Log.i(TAG, "Sync starting · origin=" + origin);

        try {
            byte[] manifestBytes = httpGet(origin + "/manifest.json");
            if (manifestBytes == null) return Result.retry();

            JSONObject remote = new JSONObject(new String(manifestBytes, "UTF-8"));
            String remoteVersion = remote.optString("version", "");
            String localVersion  = ContentStore.currentVersion(ctx);

            if (remoteVersion.isEmpty()) {
                Log.w(TAG, "Remote manifest has no version — skipping");
                return Result.success();
            }
            if (remoteVersion.equals(localVersion)) {
                Log.i(TAG, "Up-to-date (" + remoteVersion + ")");
                return Result.success();
            }

            Log.i(TAG, "Updating " + localVersion + " → " + remoteVersion);
            JSONArray files = remote.getJSONArray("files");
            int changed = 0;
            for (int i = 0; i < files.length(); i++) {
                JSONObject f = files.getJSONObject(i);
                String relPath  = f.getString("path");
                String remoteNm = f.optString("remote", relPath);   // default: same as local path
                String wantSha  = f.getString("sha256");
                File   local    = ContentStore.file(ctx, relPath);

                String haveSha = local.exists() ? sha256(local) : "";
                if (wantSha.equalsIgnoreCase(haveSha)) continue;

                String remoteUrl = origin + "/" + remoteNm;
                byte[] body = httpGet(remoteUrl);
                if (body == null) {
                    Log.w(TAG, "Download failed: " + remoteUrl + " — keeping previous copy");
                    return Result.retry();
                }
                String gotSha = sha256(body);
                if (!wantSha.equalsIgnoreCase(gotSha)) {
                    Log.w(TAG, "Checksum mismatch on " + remoteUrl + " — keeping previous copy");
                    return Result.retry();
                }
                ContentStore.writeAtomic(ctx, relPath, body);
                changed++;
                Log.i(TAG, "✓ " + remoteNm + " → " + relPath + " (" + body.length + " B)");
            }

            // Persist the new manifest last (so a mid-sync crash re-tries next time)
            ContentStore.writeAtomic(ctx, "manifest.json", manifestBytes);
            ContentStore.setCurrentVersion(ctx, remoteVersion);
            Log.i(TAG, "Sync done · " + changed + " file(s) updated");

            if (changed > 0) MainActivity.requestReload(ctx);
            return Result.success();
        } catch (Exception e) {
            Log.w(TAG, "Sync failed: " + e.getMessage());
            return Result.retry();
        }
    }

    private static byte[] httpGet(String url) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(TIMEOUT_MS);
            c.setReadTimeout(TIMEOUT_MS);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("User-Agent", "iiyama-docs-wall/2 (Android)");
            int code = c.getResponseCode();
            if (code < 200 || code >= 300) {
                Log.w(TAG, "HTTP " + code + " on " + url);
                return null;
            }
            try (InputStream in = c.getInputStream();
                 ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[64 * 1024];
                int r;
                while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
                return out.toByteArray();
            }
        } catch (Exception e) {
            Log.w(TAG, "GET failed: " + url + " — " + e.getMessage());
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new java.io.FileInputStream(f)) {
            byte[] buf = new byte[64 * 1024];
            int r;
            while ((r = in.read(buf)) > 0) md.update(buf, 0, r);
        }
        return hex(md.digest());
    }
    private static String sha256(byte[] data) throws Exception {
        return hex(MessageDigest.getInstance("SHA-256").digest(data));
    }
    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }
}
