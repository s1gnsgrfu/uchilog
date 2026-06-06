import type { Profile } from '../utils/types'

type AvatarProps = {
    profile: Profile | null
    fallback?: string
    size?: 'sm' | 'md' | 'lg'
}

const sizeClass = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
}

export function Avatar({ profile, fallback = 'u', size = 'md' }: AvatarProps) {
    const initial = profile?.display_name?.slice(0, 1) ?? fallback.slice(0, 1)

    if (profile?.avatar_url) {
        return (
            <div
                className={`${sizeClass[size]} shrink-0 rounded-full bg-cover bg-center ring-1 ring-black/5`}
                style={{ backgroundImage: `url(${profile.avatar_url})` }}
                aria-label={profile.display_name ?? 'ユーザーアイコン'}
            />
        )
    }

    return (
        <div
            className={`${sizeClass[size]} flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 ring-1 ring-black/5`}
            aria-label={profile?.display_name ?? 'ユーザーアイコン'}
        >
            {initial}
        </div>
    )
}
