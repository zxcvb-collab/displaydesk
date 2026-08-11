import { beforeEach, describe, expect, it, vi } from 'vitest'

const send = vi.fn()
const constructed: (string | undefined)[] = []

vi.mock('resend', () => ({
    Resend: class {
        emails = { send }
        constructor(apiKey?: string) {
            constructed.push(apiKey)
        }
    },
}))

const {
    resend,
    sendDeletionConfirmation,
    sendDeletionWarning,
    sendDisableConfirmation,
    sendTrialEndingWarning,
} = await import('./index')

beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ data: { id: 'email_1' }, error: null })
})

describe('resend', () => {
    it('constructs the client lazily and reuses it', () => {
        const first = resend()
        expect(resend()).toBe(first)
        expect(constructed).toHaveLength(1)
    })
})

const senders = [
    ['sendTrialEndingWarning', sendTrialEndingWarning],
    ['sendDisableConfirmation', sendDisableConfirmation],
    ['sendDeletionWarning', sendDeletionWarning],
    ['sendDeletionConfirmation', sendDeletionConfirmation],
] as const

describe.each(senders)('%s', (_name, sendEmail) => {
    it('sends to the recipient with a subject and the business name in the body', async () => {
        await sendEmail('owner@example.com', 'Cafe Nord')

        expect(send).toHaveBeenCalledTimes(1)
        const payload = send.mock.calls[0][0]
        expect(payload.to).toBe('owner@example.com')
        expect(payload.from).toContain('DisplayDesk')
        expect(payload.subject.length).toBeGreaterThan(0)
        expect(payload.html).toContain('Cafe Nord')
    })
})

describe('email content', () => {
    it('uses a distinct subject per lifecycle stage', async () => {
        const subjects: string[] = []
        for (const [, sendEmail] of senders) {
            send.mockClear()
            await sendEmail('owner@example.com', 'Cafe Nord')
            subjects.push(send.mock.calls[0][0].subject)
        }
        expect(new Set(subjects).size).toBe(senders.length)
    })

    it('links to the dashboard from every email that can still be acted on', async () => {
        for (const sendEmail of [sendTrialEndingWarning, sendDisableConfirmation, sendDeletionWarning]) {
            send.mockClear()
            await sendEmail('owner@example.com', 'Cafe Nord')
            expect(send.mock.calls[0][0].html).toContain('/dashboard')
        }
    })

    it('does not link to the dashboard once the account is already deleted', async () => {
        await sendDeletionConfirmation('owner@example.com', 'Cafe Nord')
        expect(send.mock.calls[0][0].html).not.toContain('/dashboard')
    })
})
