package bg.septona.docswall;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * Backstop sync.
 *
 * The normal 5-minute polling happens inside MainActivity while the kiosk runs.
 * This worker exists for the case where the activity was killed by the system:
 * WorkManager survives process death and reboots, so content still gets refreshed
 * (and the watchdog will bring the activity back).
 *
 * WorkManager's minimum periodic interval is 15 minutes, so this cannot be set
 * to 5 — that's exactly why the in-activity poller does the fast cadence.
 */
public class SyncWorker extends Worker {

    private static final String TAG = "SyncWorker";

    public SyncWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    @NonNull @Override public Result doWork() {
        Context ctx = getApplicationContext();
        ContentSync.Outcome out = ContentSync.sync(ctx);
        Log.i(TAG, "Backstop sync → " + out);

        switch (out) {
            case UPDATED:
                MainActivity.requestReload(ctx);
                return Result.success();
            case UNCHANGED:
                return Result.success();
            default:
                return Result.retry();
        }
    }
}
