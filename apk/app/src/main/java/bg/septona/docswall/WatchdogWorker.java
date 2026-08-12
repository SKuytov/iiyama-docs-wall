package bg.septona.docswall;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * Every 15 min: confirm MainActivity is alive & has ticked recently.
 * If it hasn't heartbeat within the last 20 minutes, cold-start it.
 *
 * The heartbeat itself is written by MainActivity every 60 s.
 */
public class WatchdogWorker extends Worker {

    private static final String TAG = "Watchdog";
    private static final long STALE_MS = 20 * 60 * 1000L; // 20 min

    public WatchdogWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    @NonNull @Override public Result doWork() {
        Context ctx = getApplicationContext();
        long last = ctx.getSharedPreferences("hb", Context.MODE_PRIVATE).getLong("t", 0);
        long age  = System.currentTimeMillis() - last;

        boolean processAlive = isMyProcessRunning(ctx);
        Log.i(TAG, "Watchdog: heartbeatAge=" + age + "ms  processAlive=" + processAlive);

        if (!processAlive || age > STALE_MS) {
            Log.w(TAG, "Restarting MainActivity (stale=" + (age > STALE_MS) + ", dead=" + !processAlive + ")");
            Intent i = new Intent(ctx, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                     | Intent.FLAG_ACTIVITY_CLEAR_TOP
                     | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
            try { ctx.startActivity(i); } catch (Exception e) { Log.w(TAG, "start failed: " + e); }
        }
        return Result.success();
    }

    private boolean isMyProcessRunning(Context ctx) {
        try {
            ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
            if (am == null) return true;   // fail-open
            String pkg = ctx.getPackageName();
            for (ActivityManager.RunningAppProcessInfo p : am.getRunningAppProcesses()) {
                if (pkg.equals(p.processName)) return true;
            }
            return false;
        } catch (Exception e) { return true; }
    }
}
