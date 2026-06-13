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
import type { Diary, DiaryReaction, DiaryReactionSummary, DiaryWithAuthor, Profile } from '../utils/types'

const TIMELINE_REFRESH_INTERVAL_MS = 30 * 1000
const LIKE_REACTION = 'like'

const buildReactionSummaries = (reactions: DiaryReaction[], currentUserId: string) => {
    const summaries: Record<string, DiaryReactionSummary> = {}

    reactions.forEach((reaction) => {
        const summary = summaries[reaction.diary_id] ?? {
            count: 0,
            reactedByCurrentUser: false,
        }

        summary.count += 1
        summary.reactedByCurrentUser = summary.reactedByCurrentUser || reaction.user_id === currentUserId
        summaries[reaction.diary_id] = summary
    })

    return summaries
}

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
    const userRef = useRef<User | null>(null)
    const lastUpdatedAtRef = useRef<Date | null>(null)
    const isRefreshingRef = useRef(false)
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [diaries, setDiaries] = useState<DiaryWithAuthor[]>([])
    const [reactionSummaries, setReactionSummaries] = useState<Record<string, DiaryReactionSummary>>({})
    const [pendingReactionIds, setPendingReactionIds] = useState<string[]>([])
    const [message, setMessage] = useState('')
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [refreshError, setRefreshError] = useState('')
    const [refreshNotice, setRefreshNotice] = useState('')
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
            throw new Error(`タイムラインの取得に失敗しました: ${error.message}`)
        }

        const diaryRows = (data ?? []) as Diary[]
        const diaryIds = diaryRows.map((diary) => diary.id)
        const { data: reactionData, error: reactionError } = diaryIds.length > 0
            ? await supabase
                .from('diary_reactions')
                .select('diary_id,user_id,reaction,created_at')
                .in('diary_id', diaryIds)
                .eq('reaction', LIKE_REACTION)
            : { data: [], error: null }

        if (reactionError) {
            throw new Error(`リアクションの取得に失敗しました: ${reactionError.message}`)
        }

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
        setReactionSummaries(buildReactionSummaries((reactionData ?? []) as DiaryReaction[], currentUser.id))
        setLastUpdatedAt(new Date())
    }, [])

    useEffect(() => {
        userRef.current = user
    }, [user])

    useEffect(() => {
        lastUpdatedAtRef.current = lastUpdatedAt
    }, [lastUpdatedAt])

    useEffect(() => {
        if (!refreshNotice) {
            return
        }

        const timeoutId = setTimeout(() => setRefreshNotice(''), 2500)

        return () => {
            clearTimeout(timeoutId)
        }
    }, [refreshNotice])

    const refreshTimeline = useCallback(async (showSuccessNotice = false) => {
        const currentUser = userRef.current

        if (!currentUser || isRefreshingRef.current) {
            return
        }

        isRefreshingRef.current = true
        setIsRefreshing(true)
        setRefreshError('')
        setRefreshNotice('')

        try {
            const syncedProfile = await withTimeout(
                syncProfile(currentUser),
                'プロフィールの更新に時間がかかっています'
            )

            setProfile(syncedProfile)
            await withTimeout(
                fetchTimeline(currentUser, syncedProfile),
                'タイムラインの更新に時間がかかっています'
            )

            if (showSuccessNotice) {
                setRefreshNotice('最新の状態です')
            }
        } catch {
            setRefreshError('更新できませんでした。通信状態を確認してください。')
        } finally {
            isRefreshingRef.current = false
            setIsRefreshing(false)
        }
    }, [fetchTimeline])

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible' || !userRef.current) {
                return
            }

            const currentLastUpdatedAt = lastUpdatedAtRef.current

            if (!currentLastUpdatedAt) {
                void refreshTimeline()
                return
            }

            const elapsedMs = Date.now() - currentLastUpdatedAt.getTime()

            if (elapsedMs >= TIMELINE_REFRESH_INTERVAL_MS) {
                void refreshTimeline()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [refreshTimeline])

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
                    setReactionSummaries({})
                    setLastUpdatedAt(null)
                    setRefreshError('')
                    setRefreshNotice('')
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
                setRefreshError('')
                setRefreshNotice('')

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
                setReactionSummaries({})
                setLastUpdatedAt(null)
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
        setReactionSummaries({})
        setLastUpdatedAt(null)
        setRefreshError('')
        setRefreshNotice('')
        setIsLogoutConfirmOpen(false)
    }

    const toggleReaction = async (diaryId: string) => {
        if (!user || pendingReactionIds.includes(diaryId)) {
            return
        }

        const summary = reactionSummaries[diaryId] ?? {
            count: 0,
            reactedByCurrentUser: false,
        }

        setPendingReactionIds((current) => [...current, diaryId])
        setMessage('')

        const reactionQuery = supabase.from('diary_reactions')
        const { error } = summary.reactedByCurrentUser
            ? await reactionQuery
                .delete()
                .eq('diary_id', diaryId)
                .eq('user_id', user.id)
                .eq('reaction', LIKE_REACTION)
            : await reactionQuery
                .insert({
                    diary_id: diaryId,
                    user_id: user.id,
                    reaction: LIKE_REACTION,
                })

        setPendingReactionIds((current) => current.filter((pendingDiaryId) => pendingDiaryId !== diaryId))

        if (error) {
            setMessage(`リアクションの更新に失敗しました: ${error.message}`)
            return
        }

        setReactionSummaries((current) => {
            const currentSummary = current[diaryId] ?? {
                count: 0,
                reactedByCurrentUser: false,
            }
            const nextReacted = !currentSummary.reactedByCurrentUser

            return {
                ...current,
                [diaryId]: {
                    count: Math.max(0, currentSummary.count + (nextReacted ? 1 : -1)),
                    reactedByCurrentUser: nextReacted,
                },
            }
        })
    }

    const lastUpdatedLabel = useMemo(() => {
        if (!lastUpdatedAt) {
            return '未更新'
        }

        return `最終更新 ${lastUpdatedAt.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
        })}`
    }, [lastUpdatedAt])

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

            <div className="fixed left-0 right-0 top-[calc(env(safe-area-inset-top)+57px)] z-30 px-3 py-2">
                <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-xl bg-white/95 px-3 py-2 text-sm shadow-sm ring-1 ring-black/5 backdrop-blur">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-700">{lastUpdatedLabel}</p>
                        {isRefreshing && <p className="text-xs font-semibold text-zinc-500">更新中...</p>}
                        {refreshNotice && <p className="text-xs font-semibold text-emerald-700">{refreshNotice}</p>}
                        {refreshError && <p className="text-xs font-semibold text-red-600">{refreshError}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={() => void refreshTimeline(true)}
                        disabled={isRefreshing}
                        className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950 disabled:text-zinc-300"
                    >
                        {isRefreshing ? '更新中' : '更新'}
                    </button>
                </div>
            </div>

            <section className="mx-auto max-w-3xl px-3 pb-36 pt-24 sm:pb-6">
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
                                    const thumbnail = getFirstMarkdownImage(diary.body, diary.user_id)
                                    const thumbnailSrc = thumbnail ? getTimelineThumbnailUrl(thumbnail.src) : null
                                    const reactionSummary = reactionSummaries[diary.id] ?? {
                                        count: 0,
                                        reactedByCurrentUser: false,
                                    }
                                    const isReactionPending = pendingReactionIds.includes(diary.id)

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
                                                <button
                                                    type="button"
                                                    onClick={() => void toggleReaction(diary.id)}
                                                    disabled={isReactionPending}
                                                    aria-pressed={reactionSummary.reactedByCurrentUser}
                                                    aria-label={reactionSummary.reactedByCurrentUser ? 'いいねを取り消す' : 'いいねする'}
                                                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ring-1 transition disabled:opacity-60 ${
                                                        reactionSummary.reactedByCurrentUser
                                                            ? 'bg-amber-100 text-amber-800 ring-amber-200 hover:bg-amber-200'
                                                            : 'bg-white/90 text-zinc-500 ring-black/5 hover:text-zinc-950'
                                                    }`}
                                                >
                                                    <span aria-hidden="true">👍</span>
                                                    <span>{reactionSummary.count}</span>
                                                </button>
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
