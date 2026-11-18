package app.pulse.tracker;

import android.Manifest;
import android.content.Context;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;

import java.util.Map;
import java.util.TreeMap;

/**
 * Bridge for the phone's own step and sleep tracking (see PhoneTracking) and the home-screen widgets.
 * - start({ askPermission }): asks for "Physical activity" if needed, starts tracking → { steps, sleep, message? }
 * - readSteps({ days }): → { days: [{ start (local midnight ms), count }] }
 * - readSleep(): → { segments: [{ start, end }] } detected nights kept on the phone
 * - setWidgetData(data): today's numbers from the app for the widgets (src/native/widgets.ts)
 */
@CapacitorPlugin(
    name = "PhoneSensors",
    permissions = {
        @Permission(strings = { Manifest.permission.ACTIVITY_RECOGNITION }, alias = "activity")
    }
)
public class PhoneSensorsPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        if (PhoneTracking.hasActivityPermission(getContext())) {
            startTracking(call);
        } else if (call.getBoolean("askPermission", false)) {
            requestPermissionForAlias("activity", call, "startAfterPermission");
        } else {
            resolveStatus(call, false, false, "Allow \"Physical activity\" for Pulse so the phone can count steps and detect sleep (Settings → Phone sync).");
        }
    }

    @PermissionCallback
    private void startAfterPermission(PluginCall call) {
        if (PhoneTracking.hasActivityPermission(getContext())) startTracking(call);
        else resolveStatus(call, false, false, "\"Physical activity\" permission was not granted, so the phone can't count steps or detect sleep.");
    }

    private void startTracking(PluginCall call) {
        Context c = getContext();
        final Task<Void> steps = PhoneTracking.recordingAvailable(c)
            ? PhoneTracking.subscribeSteps(c, false)
            : Tasks.forException(new Exception("Google Play services needs an update"));
        final Task<Void> sleep = Build.VERSION.SDK_INT >= 29
            ? PhoneTracking.subscribeSleep(c)
            : Tasks.forException(new Exception("needs Android 10 or newer"));
        Tasks.whenAllComplete(steps, sleep).addOnCompleteListener(t -> {
            StringBuilder msg = new StringBuilder();
            if (!steps.isSuccessful()) msg.append("Phone step counting is off: ").append(reason(steps)).append(". ");
            if (!sleep.isSuccessful()) msg.append("Phone sleep detection is off: ").append(reason(sleep)).append(".");
            resolveStatus(call, steps.isSuccessful(), sleep.isSuccessful(), msg.toString().trim());
        });
    }

    private static String reason(Task<?> t) {
        Exception e = t.getException();
        return e == null || e.getMessage() == null ? "unknown error" : e.getMessage();
    }

    private void resolveStatus(PluginCall call, boolean steps, boolean sleep, String message) {
        JSObject ret = new JSObject();
        ret.put("steps", steps);
        ret.put("sleep", sleep);
        if (message != null && !message.isEmpty()) ret.put("message", message);
        call.resolve(ret);
    }

    @PluginMethod
    public void readSteps(PluginCall call) {
        if (!PhoneTracking.hasActivityPermission(getContext())) {
            call.reject("Physical activity permission was not granted", "DENIED");
            return;
        }
        int days = call.getInt("days", 10);
        PhoneTracking.readDailySteps(getContext(), days).addOnCompleteListener(t -> {
            if (!t.isSuccessful()) {
                call.reject("Could not read steps: " + reason(t));
                return;
            }
            TreeMap<Long, Integer> byDay = t.getResult();
            JSArray out = new JSArray();
            for (Map.Entry<Long, Integer> e : byDay.entrySet()) {
                JSObject d = new JSObject();
                d.put("start", e.getKey().longValue());
                d.put("count", e.getValue().intValue());
                out.put(d);
            }
            JSObject ret = new JSObject();
            ret.put("days", out);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void readSleep(PluginCall call) {
        JSArray out = new JSArray();
        for (long[] s : PhoneTracking.readSegments(getContext())) {
            JSObject o = new JSObject();
            o.put("start", s[0]);
            o.put("end", s[1]);
            out.put(o);
        }
        JSObject ret = new JSObject();
        ret.put("segments", out);
        call.resolve(ret);
    }

    @PluginMethod
    public void setWidgetData(PluginCall call) {
        PulseWidget.saveData(getContext(), call.getData().toString());
        PulseWidget.refreshAll(getContext());
        call.resolve();
    }
}
