package bg.septona.docswall;

import android.app.Application;
import androidx.work.Configuration;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

public class App extends Application implements Configuration.Provider {

    public static final String SYNC_WORK  = "sync-content-work";
    public static final String GUARD_WORK = "watchdog-work";

    @Override public void onCreate() {
        super.onCreate();
        ensureContentBundled();
        scheduleBackgroundJobs();
    }

    /** First-run: copy the offline snapshot from assets/web/ into internal storage. */
    private void ensureContentBundled() {
        try {
            ContentStore.ensureBundle(this);
        } catch (Exception ignored) {
            // Any error here still leaves the WebView with the previous copy — or a soft error page.
        }
    }

    private void scheduleBackgroundJobs() {
        Constraints net = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();

        // Sync every 6 h when online
        PeriodicWorkRequest sync = new PeriodicWorkRequest.Builder(
                SyncWorker.class, 6, TimeUnit.HOURS)
            .setConstraints(net)
            .setInitialDelay(2, TimeUnit.MINUTES)
            .build();
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                SYNC_WORK, ExistingPeriodicWorkPolicy.KEEP, sync);

        // Watchdog every 15 min (no network requirement)
        PeriodicWorkRequest guard = new PeriodicWorkRequest.Builder(
                WatchdogWorker.class, 15, TimeUnit.MINUTES)
            .setInitialDelay(15, TimeUnit.MINUTES)
            .build();
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                GUARD_WORK, ExistingPeriodicWorkPolicy.KEEP, guard);
    }

    @Override public Configuration getWorkManagerConfiguration() {
        return new Configuration.Builder().setMinimumLoggingLevel(android.util.Log.INFO).build();
    }
}
