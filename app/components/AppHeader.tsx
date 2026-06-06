import Link from 'next/link'
import type { ReactNode } from 'react'

type AppHeaderProps = {
    actions?: ReactNode
}

export function AppHeader({ actions }: AppHeaderProps) {
    return (
        <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
                <Link href="/timeline" className="shrink-0 font-bold text-zinc-950">
                    UchiLog
                </Link>
                {actions && <div className="hidden min-w-0 items-center gap-2 sm:flex">{actions}</div>}
            </div>
        </header>
    )
}
