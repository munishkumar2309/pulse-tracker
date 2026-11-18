package app.pulse.tracker;

import android.content.Context;
import android.widget.RemoteViews;

/** 4×2 widget: steps, last night's sleep, water and today's spend. */
public class TodayWidget extends PulseWidget {
    @Override
    protected int layout() {
        return R.layout.widget_today;
    }

    @Override
    protected void fill(Context c, RemoteViews v, Data d) {
        v.setTextViewText(R.id.steps_value, count(d.steps));
        v.setTextViewText(R.id.steps_sub, "of " + count(d.stepGoal));
        v.setTextViewText(R.id.sleep_value, d.sleepMin >= 0 ? hoursMinutes(d.sleepMin) : NONE);
        v.setTextViewText(R.id.water_value, d.isToday ? litres(d.waterMl) : NONE);
        v.setTextViewText(R.id.water_sub, d.waterGoalMl > 0 ? "of " + litres(d.waterGoalMl) : "today");
        v.setTextViewText(R.id.spent_value, d.spent != null ? d.spent : NONE);
    }
}
