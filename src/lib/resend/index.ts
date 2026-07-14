import { Resend } from 'resend'

// Lazy — Resend's constructor throws immediately if the API key is
// missing, and Next.js imports route modules at build time (before env
// vars like RESEND_API_KEY are necessarily set), which would break builds
let _resend: Resend | null = null
export function resend(): Resend {
    if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
    return _resend
}

const FROM = 'DisplayDesk <onboarding@resend.dev>' // swap for a verified sending domain once set up in Resend

export async function sendTrialEndingWarning(to: string, businessName: string) {
    await resend().emails.send({
        from: FROM,
        to,
        subject: 'Your free screen goes on pause in 2 weeks',
        html: `
            <p>Hi there,</p>
            <p>Quick heads up: your DisplayDesk free trial for <strong>${businessName}</strong> ends in 2 weeks. After that, your screen will pause until you upgrade.</p>
            <p><strong>Nothing gets deleted right away</strong> — your videos and settings stay exactly as they are. But your TV will stop playing content until you're on a paid plan.</p>
            <p>Upgrading takes under a minute and starts at $9/month for 2 screens.</p>
            <p><a href="https://displaydesk.vercel.app/dashboard">Upgrade now</a> and keep your screen running without interruption.</p>
        `,
    })
}

export async function sendDisableConfirmation(to: string, businessName: string) {
    await resend().emails.send({
        from: FROM,
        to,
        subject: 'Your screen has been paused (your data is safe)',
        html: `
            <p>Hi there,</p>
            <p>Your DisplayDesk free trial for <strong>${businessName}</strong> has ended, so your screen has been paused — your TV will show a simple "upgrade required" message instead of your menu content.</p>
            <p><strong>Good news: nothing is lost.</strong> Your videos, your screen name, your PIN — all still there, exactly as you left them. The moment you upgrade, everything comes right back.</p>
            <p>Plans start at $9/month for 2 screens.</p>
            <p><a href="https://displaydesk.vercel.app/dashboard">Reactivate my screen</a></p>
            <p>If you decided DisplayDesk isn't the right fit, no hard feelings — we'd genuinely love to know why. Just reply and let us know.</p>
        `,
    })
}

export async function sendDeletionWarning(to: string, businessName: string) {
    await resend().emails.send({
        from: FROM,
        to,
        subject: 'Final notice: your account deletes in 15 days',
        html: `
            <p>Hi there,</p>
            <p>This is a final notice: your DisplayDesk account for <strong>${businessName}</strong> and all its stored videos will be <strong>permanently deleted in 15 days</strong> unless you upgrade before then.</p>
            <p>This isn't reversible after it happens — so if there's any chance you'll want this account again, now's the time to act.</p>
            <p><a href="https://displaydesk.vercel.app/dashboard">Upgrade now and keep everything</a> — starts at $9/month, takes under a minute.</p>
            <p>If you're sure you're done with DisplayDesk, you don't need to do anything — the account will be cleaned up automatically and no further charges or emails will follow.</p>
        `,
    })
}

export async function sendDeletionConfirmation(to: string, businessName: string) {
    await resend().emails.send({
        from: FROM,
        to,
        subject: 'Your DisplayDesk account has been deleted',
        html: `
            <p>Hi there,</p>
            <p>As we mentioned, your DisplayDesk account for <strong>${businessName}</strong> and its stored videos have now been permanently deleted since the account stayed on the free plan past the 9-month mark.</p>
            <p>No further emails or charges will follow.</p>
            <p>If you ever want to give DisplayDesk another shot, you're always welcome to sign up fresh — no hard feelings, and no penalty for having let this one lapse.</p>
            <p>Thanks for trying us out.</p>
        `,
    })
}
