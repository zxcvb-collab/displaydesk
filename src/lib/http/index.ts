/**
 * Reads the `error` field out of a failed API response so the UI can show
 * what actually went wrong, falling back to the given message when the
 * body isn't the expected JSON error shape (e.g. an HTML error page).
 */
export async function responseError(res: Response, fallback: string): Promise<string> {
    try {
        const body = await res.json()
        if (body && typeof body.error === 'string' && body.error) return body.error
    } catch {
        // not a JSON error body — fall through to the generic message
    }
    return fallback
}

export function errorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message
    return fallback
}
