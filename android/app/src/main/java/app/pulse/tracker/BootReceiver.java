package app.pulse.tracker;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;

/**
 * Sleep API requests are dropped on reboot and app update, so register again then.
 * Step recording is renewed after a reboot only (see PhoneTracking.subscribeSteps).
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        boolean boot = Intent.ACTION_BOOT_COMPLETED.equals(action);
        if (!boot && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) return;
        if (!PhoneTracking.hasActivityPermission(context)) return;

        final PendingResult pending = goAsync();
        Task<Void> steps = PhoneTracking.recordingAvailable(context)
            ? PhoneTracking.subscribeSteps(context, boot)
            : Tasks.forResult(null);
        Task<Void> sleep = Build.VERSION.SDK_INT >= 29 ? PhoneTracking.subscribeSleep(context) : Tasks.forResult(null);
        Tasks.whenAllComplete(steps, sleep).addOnCompleteListener(t -> pending.finish());
    }
}
