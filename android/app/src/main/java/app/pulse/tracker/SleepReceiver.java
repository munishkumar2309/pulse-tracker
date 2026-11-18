package app.pulse.tracker;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.google.android.gms.location.SleepSegmentEvent;

/** Receives nights detected by Google's Sleep API (usually soon after waking), even when Pulse is closed. */
public class SleepReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!SleepSegmentEvent.hasEvents(intent)) return;
        for (SleepSegmentEvent e : SleepSegmentEvent.extractEvents(intent)) {
            // MISSING_DATA / NOT_DETECTED segments are guesses with gaps; skip them.
            if (e.getStatus() == SleepSegmentEvent.STATUS_SUCCESSFUL) {
                PhoneTracking.addSleep(context, e.getStartTimeMillis(), e.getEndTimeMillis());
            }
        }
        PulseWidget.refreshAll(context);
    }
}
