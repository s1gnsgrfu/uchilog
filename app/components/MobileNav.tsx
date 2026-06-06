import { AppLink } from './AppLink'

type MobileNavProps = {
    active?: 'timeline' | 'write' | 'menu'
}

export function MobileNav({ active }: MobileNavProps) {
    const linkClass = (name: 'timeline' | 'write' | 'menu') =>
        `flex flex-1 flex-col items-center rounded-xl px-3 py-2 text-sm font-semibold transition ${
            active === name ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
        }`

    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/90 px-3 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+1rem))] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden">
            <div className="mx-auto flex max-w-md items-center gap-2">
                <AppLink href="/timeline" className={linkClass('timeline')}>
                    タイムライン
                </AppLink>
                <AppLink href="/write" className={linkClass('write')}>
                    書く
                </AppLink>
                <AppLink href="/menu" className={linkClass('menu')}>
                    メニュー
                </AppLink>
            </div>
        </nav>
    )
}
