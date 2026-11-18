package app.pulse.tracker;

import android.content.Context;
import android.widget.RemoteViews;

/** 2×2 widget: today's steps with a bar towards the goal. */
public class StepsWidget extends PulseWidget {
    @Override
    protected int layout() {
        return R.layout.widget_steps;
    }

    @Override
    protected void fill(Context c, RemoteViews v, Data d) {
        int pct = d.stepGoal > 0 ? Math.min(100, Math.round(100f * d.steps / d.stepGoal)) : 0;
        v.setTextViewText(R.id.steps_value, count(d.steps));
        v.setTextViewText(R.id.steps_sub, "of " + count(d.stepGoal) + " · " + pct + "%");
        v.setProgressBar(R.id.steps_bar, 100, pct, false);
    }
}
