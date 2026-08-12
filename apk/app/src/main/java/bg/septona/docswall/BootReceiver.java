package bg.septona.docswall;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context ctx, Intent intent) {
        String a = intent.getAction();
        if (a == null) return;
        if (a.equals(Intent.ACTION_BOOT_COMPLETED)
         || a.equals("android.intent.action.LOCKED_BOOT_COMPLETED")
         || a.equals(Intent.ACTION_MY_PACKAGE_REPLACED)) {
            Intent i = new Intent(ctx, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        }
    }
}
