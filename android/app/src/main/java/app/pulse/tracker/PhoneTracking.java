package app.pulse.tracker;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.fitness.FitnessLocal;
import com.google.android.gms.fitness.LocalRecordingClient;
import com.google.android.gms.fitness.data.LocalBucket;
import com.google.android.gms.fitness.data.LocalDataPoint;
import com.google.android.gms.fitness.data.LocalDataSet;
import com.google.android.gms.fitness.data.LocalDataType;
import com.google.android.gms.fitness.data.LocalField;
import com.google.android.gms.fitness.request.LocalDataReadRequest;
import com.google.android.gms.location.ActivityRecognition;
import com.google.android.gms.location.SleepSegmentRequest;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.List;
import java.util.TreeMap;
import java.util.concurrent.TimeUnit;

/**
 * Step and sleep tracking with the phone's own sensors, all on the device:
 * - Steps: Google's Recording API (play-services-fitness). Play services counts steps in the background
 *   with low power and keeps 10 days; no Google account, nothing leaves the phone.
 * - Sleep: Google's Sleep API (play-services-location), which uses the accelerometer and light sensor.
 *   Detected nights arrive at SleepReceiver (even when Pulse is closed) and are kept here until the app reads them.
 * Used by PhoneSensorsPlugin, SleepReceiver, BootReceiver and the widgets.
 */
@SuppressLint("MissingPermission") // every caller checks hasActivityPermission() first
final class PhoneTracking {
    private static final String PREFS = "pulse_phone";
    private static final String KEY_STEPS_SUBSCRIBED = "stepsSubscribed";
    private static final String KEY_SLEEP = "sleepSegments";
    private static final int MAX_SEGMENTS = 30;

    private PhoneTracking() { }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** "Physical activity" permission. Below Android 10 it is granted at install. */
    static boolean hasActivityPermission(Context c) {
        if (Build.VERSION.SDK_INT < 29) return true;
        return ContextCompat.checkSelfPermission(c, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean recordingAvailable(Context c) {
        return GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(
            c, LocalRecordingClient.LOCAL_RECORDING_CLIENT_MIN_VERSION_CODE) == ConnectionResult.SUCCESS;
    }

    /**
     * Start step recording. Done once (and again after a reboot, force=true): Google keeps data "since the latest
     * subscription", so re-subscribing on every launch could cut the history short.
     */
    static Task<Void> subscribeSteps(Context c, boolean force) {
        final SharedPreferences p = prefs(c);
        if (!force && p.getBoolean(KEY_STEPS_SUBSCRIBED, false)) return Tasks.forResult(null);
        return FitnessLocal.getLocalRecordingClient(c)
            .subscribe(LocalDataType.TYPE_STEP_COUNT_DELTA)
            .addOnSuccessListener(v -> p.edit().putBoolean(KEY_STEPS_SUBSCRIBED, true).apply());
    }

    /** Daily step totals for the last `days` days (today included), keyed by local midnight in epoch ms. */
    static Task<TreeMap<Long, Integer>> readDailySteps(Context c, int days) {
        Calendar cal = Calendar.getInstance();
        long end = cal.getTimeInMillis();
        long start = startOfDay(end) - (long) (days - 1) * TimeUnit.DAYS.toMillis(1);
        // Buckets start at `start` (local midnight), so each one is a local calendar day. India has no DST.
        LocalDataReadRequest request = new LocalDataReadRequest.Builder()
            .aggregate(LocalDataType.TYPE_STEP_COUNT_DELTA)
            .bucketByTime(1, TimeUnit.DAYS)
            .setTimeRange(start / 1000, end / 1000, TimeUnit.SECONDS)
            .build();
        return FitnessLocal.getLocalRecordingClient(c).readData(request).continueWith(t -> {
            TreeMap<Long, Integer> byDay = new TreeMap<>();
            for (LocalBucket bucket : t.getResult().getBuckets()) {
                for (LocalDataSet set : bucket.getDataSets()) {
                    for (LocalDataPoint dp : set.getDataPoints()) {
                        long day = startOfDay(dp.getStartTime(TimeUnit.MILLISECONDS));
                        int steps = dp.getValue(LocalField.FIELD_STEPS).asInt();
                        Integer prev = byDay.get(day);
                        byDay.put(day, (prev == null ? 0 : prev) + steps);
                    }
                }
            }
            return byDay;
        });
    }

    static long startOfDay(long ms) {
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(ms);
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        return cal.getTimeInMillis();
    }

    // ---- Sleep ----

    private static PendingIntent sleepIntent(Context c) {
        Intent intent = new Intent(c, SleepReceiver.class);
        // Mutable: Play services adds the events to this intent.
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        return PendingIntent.getBroadcast(c, 0, intent, flags);
    }

    /** Ask for detected sleep segments (one per night, after waking). Safe to call again: it replaces the request. */
    static Task<Void> subscribeSleep(Context c) {
        return ActivityRecognition.getClient(c).requestSleepSegmentUpdates(
            sleepIntent(c), new SleepSegmentRequest(SleepSegmentRequest.SEGMENT_EVENTS_ONLY));
    }

    static synchronized void addSleep(Context c, long start, long end) {
        List<long[]> list = readSegments(c);
        for (long[] s : list) if (s[0] == start) return;
        list.add(new long[] { start, end });
        Collections.sort(list, (a, b) -> Long.compare(a[0], b[0]));
        while (list.size() > MAX_SEGMENTS) list.remove(0);
        JSONArray out = new JSONArray();
        try {
            for (long[] s : list) out.put(new JSONObject().put("start", s[0]).put("end", s[1]));
        } catch (JSONException ignored) { }
        prefs(c).edit().putString(KEY_SLEEP, out.toString()).apply();
    }

    /** Stored segments as [start, end] epoch ms, oldest first. */
    static synchronized List<long[]> readSegments(Context c) {
        List<long[]> list = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(prefs(c).getString(KEY_SLEEP, "[]"));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                list.add(new long[] { o.getLong("start"), o.getLong("end") });
            }
        } catch (JSONException ignored) { }
        return list;
    }

    /** Minutes of phone-detected sleep that ended today, or -1 if none (used by the widgets). */
    static int sleepMinutesEndingToday(Context c) {
        long today = startOfDay(System.currentTimeMillis());
        long total = 0;
        boolean any = false;
        for (long[] s : readSegments(c)) {
            if (s[1] >= today && s[1] - s[0] >= TimeUnit.HOURS.toMillis(1)) {
                total += s[1] - s[0];
                any = true;
            }
        }
        return any ? (int) TimeUnit.MILLISECONDS.toMinutes(total) : -1;
    }
}
