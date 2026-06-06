'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps, MouseEvent } from 'react'

type AppLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
    href: string
}

export function AppLink({ href, onClick, replace, scroll, target, ...props }: AppLinkProps) {
    const router = useRouter()

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event)

        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            (target && target !== '_self') ||
            !href.startsWith('/') ||
            href.startsWith('//')
        ) {
            return
        }

        event.preventDefault()

        if (replace) {
            router.replace(href, { scroll })
            return
        }

        router.push(href, { scroll })
    }

    return (
        <Link
            href={href}
            onClick={handleClick}
            replace={replace}
            scroll={scroll}
            target={target}
            {...props}
        />
    )
}
