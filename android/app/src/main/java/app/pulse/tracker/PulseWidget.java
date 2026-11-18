package app.pulse.tracker;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.icu.text.NumberFormat;
import android.widget.RemoteViews;

import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TreeMap;

/**
 * Base for the home-screen widgets (TodayWidget, StepsWidget).
 * Numbers come from the app (setWidgetData → saved here) plus the live phone step count, so steps keep
 * moving even when Pulse hasn't been opened. Numbers from an earlier day are hidden ("—"), never shown as today's.
 * Refreshed every 30 min (the Android minimum), when the app's data changes, and when a night of sleep arrives.
 */
public abstract class PulseWidget extends AppWidgetProvider {
    private static final String PREFS = "pulse_widget";
    private static final String KEY_DATA = "data";
    static final String NONE = "—";

    protected abstract int layout();

    protected abstract void fill(Context c, RemoteViews v, Data d);

    static void saveData(Context c, String json) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_DATA, json).apply();
    }

    /** Ask every placed Pulse widget to redraw. */
    static void refreshAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Class<?> cls : new Class<?>[] { TodayWidget.class, StepsWidget.class }) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, cls));
            if (ids == null || ids.length == 0) continue;
            Intent i = new Intent(c, cls)
                .setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            c.sendBroadcast(i);
        }
    }

    @Override
    public void onUpdate(final Context c, final AppWidgetManager m, final int[] ids) {
        final PendingResult pending = goAsync();
        final Data d = Data.load(c);
        Task<TreeMap<Long, Integer>> live = PhoneTracking.hasActivityPermission(c) && PhoneTracking.recordingAvailable(c)
            ? PhoneTracking.readDailySteps(c, 1)
            : Tasks.forException(new Exception("phone step counting is off"));
        live.addOnCompleteListener(t -> {
            try {
                if (t.isSuccessful() && !d.stepsManual) {
                    Integer today = t.getResult().get(PhoneTracking.startOfDay(System.currentTimeMillis()));
                    if (today != null) d.steps = Math.max(d.steps, today);
                }
                for (int id : ids) {
                    RemoteViews v = new RemoteViews(c.getPackageName(), layout());
                    fill(c, v, d);
                    v.setOnClickPendingIntent(R.id.widget_root, openApp(c));
                    m.updateAppWidget(id, v);
                }
            } finally {
                pending.finish();
            }
        });
    }

    private static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    // ---- Formatting (same style as the app: Indian digit grouping) ----

    static String count(int n) {
        return NumberFormat.getIntegerInstance(Locale.forLanguageTag("en-IN")).format(n);
    }

    static String hoursMinutes(int min) {
        return (min / 60) + "h " + (min % 60) + "m";
    }

    static String litres(int ml) {
        return String.format(Locale.US, "%.1f L", ml / 1000f);
    }

    /** Today's numbers. Fields from an earlier day stay at their "unknown" values. */
    static final class Data {
        boolean isToday;
        int steps;
        boolean stepsManual;
        int stepGoal = 10000;
        int sleepMin = -1;
        int waterMl;
        int waterGoalMl;
        String spent;

        static Data load(Context c) {
            Data d = new Data();
            String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            try {
                JSONObject o = new JSONObject(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_DATA, "{}"));
                d.stepGoal = o.optInt("stepGoal", 10000);
                d.waterGoalMl = o.optInt("waterGoalMl", 0);
                d.isToday = today.equals(o.optString("date"));
                if (d.isToday) {
                    d.steps = o.optInt("steps", 0);
                    d.stepsManual = o.optBoolean("stepsManual", false);
                    d.sleepMin = o.isNull("sleepMin") ? -1 : o.optInt("sleepMin", -1);
                    d.waterMl = o.optInt("waterMl", 0);
                    d.spent = o.isNull("spent") ? null : o.optString("spent");
                }
            } catch (JSONException ignored) { }
            // A night detected after the app last ran still shows.
            if (d.sleepMin < 0) d.sleepMin = PhoneTracking.sleepMinutesEndingToday(c);
            return d;
        }
    }
}
