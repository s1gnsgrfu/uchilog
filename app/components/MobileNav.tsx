import Link from 'next/link'

type MobileNavProps = {
    active?: 'timeline' | 'write'
    onMenuClick: () => void
}

export function MobileNav({ active, onMenuClick }: MobileNavProps) {
    const linkClass = (name: 'timeline' | 'write') =>
        `flex flex-1 flex-col items-center rounded-xl px-3 py-2 text-sm font-semibold transition ${
            active === name ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
        }`

    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/90 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden">
            <div className="mx-auto flex max-w-md items-center gap-2">
                <Link href="/timeline" className={linkClass('timeline')}>
                    タイムライン
                </Link>
                <Link href="/write" className={linkClass('write')}>
                    書く
                </Link>
                <button
                    onClick={onMenuClick}
                    className="flex flex-1 flex-col items-center rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
                >
                    メニュー
                </button>
            </div>
        </nav>
    )
}
