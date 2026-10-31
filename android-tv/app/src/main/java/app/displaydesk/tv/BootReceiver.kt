package app.displaydesk.tv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Relaunches the player after a power cut or reboot. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val launch = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(launch)
    }
}
