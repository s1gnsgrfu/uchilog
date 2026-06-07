'use client'

import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { AppHeader } from '../components/AppHeader'
import { AppLink } from '../components/AppLink'
import { Avatar } from '../components/Avatar'
import { DesktopHeaderActions } from '../components/DesktopHeaderActions'
import { LogoutConfirmDialog } from '../components/LogoutConfirmDialog'
import { MobileNav } from '../components/MobileNav'
import { fetchProfilesByIds, syncProfile } from '../utils/profiles'
import { DISCORD_LOGIN_SCOPES, authErrorMessages } from '../utils/auth'
import { formatDateLabel, formatJoinedDate, getDateKey } from '../utils/format'
import { getFirstMarkdownImage, getTimelineThumbnailUrl } from '../utils/markdown'
import type { Diary, DiaryWithAuthor, Profile } from '../utils/types'

const withTimeout = async <T,>(promise: Promise<T>, message: string, timeoutMs = 10000) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
    })

    try {
        return await Promise.race([promise, timeout])
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
    }
}

export default function TimelinePage() {
    const timelineEndRef = useRef<HTMLDivElement | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [diaries, setDiaries] = useState<DiaryWithAuthor[]>([])
    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)

    const scrollToLatest = useCallback(() => {
        window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'auto',
        })
    }, [])

    const fetchTimeline = useCallback(async (currentUser: User, currentProfile: Profile | null) => {
        const { data, error } = await supabase
            .from('diaries')
            .select('*')
            .order('created_at', { ascending: true })

        if (error) {
            setMessage(`タイムラインの取得に失敗しました: ${error.message}`)
            return
        }

        const diaryRows = (data ?? []) as Diary[]
        const profileMap = await fetchProfilesByIds([
            ...diaryRows.map((diary) => diary.user_id),
            currentUser.id,
        ])

        if (currentProfile) {
            profileMap.set(currentUser.id, currentProfile)
        }

        setDiaries(
            diaryRows.map((diary) => ({
                ...diary,
                author: profileMap.get(diary.user_id) ?? null,
            }))
        )
    }, [])

    useEffect(() => {
        let isMounted = true

        const load = async () => {
            setIsLoading(true)
            let sessionUser: User | null = null
            const authError = new URLSearchParams(window.location.search).get('authError')

            try {
                const { data, error } = await withTimeout(
                    supabase.auth.getSession(),
                    'ログイン状態の確認に時間がかかっています'
                )

                if (!isMounted) {
                    return
                }

                sessionUser = data.session?.user ?? null

                if (error || !sessionUser) {
                    setUser(null)
                    setProfile(null)
                    setDiaries([])
                    if (authError && authErrorMessages[authError]) {
                        setMessage(authErrorMessages[authError])
                    }
                    setIsLoading(false)
                    return
                }

                setUser(sessionUser)

                const syncedProfile = await withTimeout(
                    syncProfile(sessionUser),
                    'プロフィールの読み込みに時間がかかっています'
                )

                if (!isMounted) {
                    return
                }

                setProfile(syncedProfile)

                await withTimeout(
                    fetchTimeline(sessionUser, syncedProfile),
                    'タイムラインの読み込みに時間がかかっています'
                )
            } catch (loadError) {
                if (!isMounted) {
                    return
                }

                const errorMessage = loadError instanceof Error ? loadError.message : '不明なエラー'
                setMessage(errorMessage)
                setUser(sessionUser)
                setProfile(null)
                setDiaries([])
            } finally {
                if (isMounted) {
                    setIsLoading(false)
                }
            }
        }

        load()

        return () => {
            isMounted = false
        }
    }, [fetchTimeline])

    useEffect(() => {
        if (!user || isLoading || diaries.length === 0) {
            return
        }

        const frameId = requestAnimationFrame(scrollToLatest)

        return () => {
            cancelAnimationFrame(frameId)
        }
    }, [diaries.length, isLoading, scrollToLatest, user])

    const groupedDiaries = useMemo(() => {
        const groups: { dateKey: string; label: string; diaries: DiaryWithAuthor[] }[] = []

        diaries.forEach((diary) => {
            const dateKey = getDateKey(diary.created_at)
            const latestGroup = groups.at(-1)

            if (latestGroup?.dateKey === dateKey) {
                latestGroup.diaries.push(diary)
                return
            }

            groups.push({
                dateKey,
                label: formatDateLabel(diary.created_at),
                diaries: [diary],
            })
        })

        return groups
    }, [diaries])

    const loginWithDiscord = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: {
                redirectTo: `${location.origin}/auth/callback`,
                scopes: DISCORD_LOGIN_SCOPES,
            },
        })

        if (error) {
            setMessage('ログインに失敗しました')
        }
    }

    const logout = async () => {
        const { error } = await supabase.auth.signOut()

        if (error) {
            setMessage('ログアウトに失敗しました')
            return
        }

        setUser(null)
        setProfile(null)
        setDiaries([])
        setIsLogoutConfirmOpen(false)
    }

    if (!user) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f6f1e8] px-5">
                <section className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
                    <div>
                        <p className="text-sm font-semibold text-emerald-700">UchiLog</p>
                        <h1 className="mt-2 text-3xl font-bold tracking-normal text-zinc-950">身内の日記を、チャットみたいに眺める。</h1>
                    </div>
                    <button
                        onClick={loginWithDiscord}
                        className="w-full rounded-full bg-zinc-950 px-5 py-3 font-semibold text-white transition hover:bg-zinc-800"
                    >
                        Discordでログイン
                    </button>
                    {message && <p className="text-sm text-red-600">{message}</p>}
                </section>

                {isLoading && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-5 backdrop-blur-[1px]">
                        <div
                            aria-label="読み込み中"
                            className="h-10 w-10 animate-spin rounded-full border-4 border-white/60 border-t-zinc-950"
                        />
                    </div>
                )}
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-[#f6f1e8]">
            <AppHeader
                actions={
                    <DesktopHeaderActions onLogout={() => setIsLogoutConfirmOpen(true)} />
                }
            />

            <section className="mx-auto max-w-3xl px-3 pb-36 pt-6 sm:pb-6">
                {message && <p className="mb-4 rounded-xl bg-white px-4 py-3 text-sm text-red-600 shadow-sm">{message}</p>}

                {groupedDiaries.length === 0 ? (
                    <div className="mt-16 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
                        <p className="font-semibold text-zinc-900">まだ日記がありません</p>
                        <p className="mt-2 text-sm text-zinc-500">最初の一日を書いて、タイムラインを始めましょう。</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groupedDiaries.map((group) => (
                            <div key={group.dateKey} className="space-y-4">
                                <div className="flex justify-center">
                                    <span className="rounded-full bg-zinc-200/80 px-3 py-1 text-xs font-medium text-zinc-600">
                                        {group.label}
                                    </span>
                                </div>

                                {group.diaries.map((diary) => {
                                    const isOwn = diary.user_id === user.id
                                    const authorName = diary.author?.display_name ?? (isOwn ? profile?.display_name : null) ?? '名無し'
                                    const thumbnail = getFirstMarkdownImage(diary.body)
                                    const thumbnailSrc = thumbnail ? getTimelineThumbnailUrl(thumbnail.src) : null

                                    return (
                                        <div
                                            key={diary.id}
                                            className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
                                        >
                                            {!isOwn && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedProfile(diary.author)}
                                                    disabled={!diary.author}
                                                    aria-label={`${authorName}のプロフィールを見る`}
                                                    className="shrink-0 rounded-full transition hover:scale-105 disabled:cursor-default disabled:hover:scale-100"
                                                >
                                                    <Avatar profile={diary.author} fallback={authorName} />
                                                </button>
                                            )}

                                            <div className={`max-w-[76%] ${isOwn ? 'text-right' : 'text-left'}`}>
                                                <p className={`mb-1 flex items-center gap-2 px-1 text-xs font-semibold text-zinc-500 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                                    <span>{authorName}</span>
                                                    {isOwn && !diary.is_shared && (
                                                        <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-[11px] text-zinc-600">
                                                            自分だけ
                                                        </span>
                                                    )}
                                                </p>
                                                <AppLink
                                                    href={`/diary/${diary.id}`}
                                                    className={`block space-y-2 rounded-2xl px-4 py-3 text-left text-sm font-semibold leading-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                                                        isOwn
                                                            ? 'rounded-br-sm bg-[#95e267] text-zinc-950'
                                                            : 'rounded-bl-sm bg-white text-zinc-950'
                                                    }`}
                                                >
                                                    <span>{diary.title}</span>
                                                    {thumbnail && (
                                                        <Image
                                                            src={thumbnailSrc ?? thumbnail.src}
                                                            alt={thumbnail.alt}
                                                            width={120}
                                                            height={80}
                                                            unoptimized
                                                            onLoad={scrollToLatest}
                                                            className="h-20 w-28 rounded-xl object-cover ring-1 ring-black/5"
                                                        />
                                                    )}
                                                </AppLink>
                                            </div>

                                            {isOwn && <Avatar profile={profile} fallback={authorName} />}
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                        <div ref={timelineEndRef} aria-hidden="true" className="h-1" />
                    </div>
                )}
            </section>

            {isLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-5 backdrop-blur-[1px]">
                    <div
                        aria-label="読み込み中"
                        className="h-10 w-10 animate-spin rounded-full border-4 border-white/60 border-t-zinc-950"
                    />
                </div>
            )}

            <MobileNav active="timeline" />

            {isLogoutConfirmOpen && (
                <LogoutConfirmDialog
                    onCancel={() => setIsLogoutConfirmOpen(false)}
                    onConfirm={logout}
                />
            )}

            {selectedProfile && (
                <div
                    onClick={() => setSelectedProfile(null)}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6"
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="profile-dialog-title"
                        onClick={(event) => event.stopPropagation()}
                        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5"
                    >
                        <button
                            onClick={() => setSelectedProfile(null)}
                            aria-label="プロフィールを閉じる"
                            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-xl font-semibold leading-none text-zinc-600 shadow-sm hover:border-zinc-400 hover:text-zinc-950"
                        >
                            ×
                        </button>

                        <div className="flex items-center gap-4 pr-10">
                            <Avatar profile={selectedProfile} fallback={selectedProfile.display_name ?? '名無し'} size="lg" />
                            <div className="min-w-0">
                                <h2 id="profile-dialog-title" className="truncate text-xl font-bold text-zinc-950">
                                    {selectedProfile.display_name ?? '名無し'}
                                </h2>
                                <p className="mt-1 text-sm text-zinc-500">
                                    {formatJoinedDate(selectedProfile.created_at)} から利用
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 rounded-xl bg-zinc-50 p-4">
                            <p className="text-xs font-bold text-zinc-500">自己紹介</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                                {selectedProfile.bio || '自己紹介はまだありません。'}
                            </p>
                        </div>
                    </section>
                </div>
            )}
        </main>
    )
}
