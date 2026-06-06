import type { ReactNode } from 'react'
import { AppLink } from './AppLink'

type AppHeaderProps = {
    actions?: ReactNode
}

export function AppHeader({ actions }: AppHeaderProps) {
    return (
        <header className="sticky top-0 z-40 border-b border-black/5 bg-[#fbf9f4]/95 pt-[env(safe-area-inset-top)] backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
                <AppLink href="/timeline" className="shrink-0 font-bold text-zinc-950">
                    UchiLog
                </AppLink>
                {actions && <div className="hidden min-w-0 items-center gap-2 sm:flex">{actions}</div>}
            </div>
        </header>
    )
}
