export default function TVNotFound() {
    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-6 opacity-40">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
            </svg>
            <p className="text-lg font-medium opacity-60 mb-2">Screen not found</p>
            <p className="text-sm opacity-30">Check the PIN and try again</p>
        </div>
    )
}
