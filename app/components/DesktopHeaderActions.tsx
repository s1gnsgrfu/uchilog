import { AppLink } from './AppLink'

type DesktopHeaderActionsProps = {
    onLogout?: () => void
    showWrite?: boolean
}

export function DesktopHeaderActions({ onLogout, showWrite = true }: DesktopHeaderActionsProps) {
    return (
        <>
            <AppLink
                href="/timeline"
                className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-950"
            >
                タイムライン
            </AppLink>
            {showWrite && (
                <AppLink
                    href="/write"
                    className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                    書く
                </AppLink>
            )}
            <AppLink
                href="/menu"
                className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-950"
            >
                メニュー
            </AppLink>
            {onLogout && (
                <button
                    onClick={onLogout}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-950"
                >
                    ログアウト
                </button>
            )}
        </>
    )
}
