package app.pulse.tracker;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Pulse's own SMS bridge (no third-party code touches the inbox).
 * - readInbox({ since, limit }): messages received after `since` (epoch ms), newest first.
 * - startListening(): emits "smsReceived" for each new SMS while the app is running.
 * Messages never leave the device; filtering to bank senders and parsing happen in JS (src/native/sms.ts).
 */
@CapacitorPlugin(
    name = "SmsReader",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS }, alias = "sms")
    }
)
public class SmsReaderPlugin extends Plugin {

    private BroadcastReceiver receiver;

    @PluginMethod
    public void readInbox(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "readAfterPermission");
            return;
        }
        read(call);
    }

    @PermissionCallback
    private void readAfterPermission(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) read(call);
        else call.reject("SMS permission was not granted", "DENIED");
    }

    private void read(PluginCall call) {
        long since = call.getLong("since", 0L);
        int limit = call.getInt("limit", 3000);
        JSArray messages = new JSArray();
        String[] projection = { Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE };
        try (Cursor c = getContext().getContentResolver().query(
                Telephony.Sms.Inbox.CONTENT_URI, projection,
                Telephony.Sms.DATE + " > ?", new String[] { String.valueOf(since) },
                Telephony.Sms.DATE + " DESC")) {
            int n = 0;
            while (c != null && c.moveToNext() && n++ < limit) {
                JSObject m = new JSObject();
                m.put("address", c.getString(0));
                m.put("body", c.getString(1));
                m.put("date", c.getLong(2));
                messages.put(m);
            }
        } catch (Exception e) {
            call.reject("Could not read SMS: " + e.getMessage());
            return;
        }
        JSObject ret = new JSObject();
        ret.put("messages", messages);
        call.resolve(ret);
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("SMS permission was not granted", "DENIED");
            return;
        }
        if (receiver == null) {
            receiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
                    if (parts == null) return;
                    // Long SMS arrive in parts; join them per sender.
                    Map<String, StringBuilder> bodies = new LinkedHashMap<>();
                    long date = System.currentTimeMillis();
                    for (SmsMessage p : parts) {
                        String from = p.getOriginatingAddress();
                        if (!bodies.containsKey(from)) bodies.put(from, new StringBuilder());
                        bodies.get(from).append(p.getMessageBody());
                        date = p.getTimestampMillis();
                    }
                    for (Map.Entry<String, StringBuilder> e : bodies.entrySet()) {
                        JSObject m = new JSObject();
                        m.put("address", e.getKey());
                        m.put("body", e.getValue().toString());
                        m.put("date", date);
                        notifyListeners("smsReceived", m);
                    }
                }
            };
            // SMS_RECEIVED is a protected system broadcast, so the receiver must be exported to get it.
            ContextCompat.registerReceiver(getContext(), receiver,
                new IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION), ContextCompat.RECEIVER_EXPORTED);
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (receiver != null) {
            try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) { }
            receiver = null;
        }
        super.handleOnDestroy();
    }
}
