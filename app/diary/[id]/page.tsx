'use client'

import { useRouter } from 'next/navigation'
import { use, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AppHeader } from '../../components/AppHeader'
import { AppLink } from '../../components/AppLink'
import { Avatar } from '../../components/Avatar'
import { LogoutConfirmDialog } from '../../components/LogoutConfirmDialog'
import { MarkdownRenderer } from '../../components/MarkdownRenderer'
import { MobileNav } from '../../components/MobileNav'
import { formatDateTime } from '../../utils/format'
import { fetchProfilesByIds } from '../../utils/profiles'
import type { Diary, DiaryWithAuthor } from '../../utils/types'

export default function DiaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [diary, setDiary] = useState<DiaryWithAuthor | null>(null)
    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isUpdatingShare, setIsUpdatingShare] = useState(false)
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

    useEffect(() => {
        const load = async () => {
            const { data: sessionData } = await supabase.auth.getSession()
            setUser(sessionData.session?.user ?? null)

            const { data, error } = await supabase
                .from('diaries')
                .select('*')
                .eq('id', id)
                .single()

            if (error) {
                setMessage(`日記の取得に失敗しました: ${error.message}`)
                setIsLoading(false)
                return
            }

            const diaryRow = data as Diary
            const profileMap = await fetchProfilesByIds([diaryRow.user_id])

            setDiary({
                ...diaryRow,
                author: profileMap.get(diaryRow.user_id) ?? null,
            })
            setIsLoading(false)
        }

        load()
    }, [id])

    const toggleSharing = async () => {
        if (!user || !diary || diary.user_id !== user.id) {
            setMessage('共有設定を変更できません')
            return
        }

        const nextShared = !diary.is_shared
        setIsUpdatingShare(true)

        const { error } = await supabase
            .from('diaries')
            .update({
                is_shared: nextShared,
                updated_at: new Date().toISOString(),
            })
            .eq('id', diary.id)

        setIsUpdatingShare(false)

        if (error) {
            setMessage(`共有設定の変更に失敗しました: ${error.message}`)
            return
        }

        setDiary({ ...diary, is_shared: nextShared })
        setMessage(nextShared ? 'この日記を共有しました' : 'この日記を自分だけに戻しました')
    }

    const logout = async () => {
        const { error } = await supabase.auth.signOut()

        if (error) {
            setMessage('ログアウトに失敗しました')
            return
        }

        setIsLogoutConfirmOpen(false)
        router.replace('/timeline')
    }

    if (isLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f6f1e8] px-5 text-zinc-600">
                日記を読み込み中
            </main>
        )
    }

    if (!diary) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f6f1e8] px-5">
                <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
                    <p className="font-semibold text-zinc-900">日記が見つかりませんでした</p>
                    <p className="mt-2 text-sm text-red-600">{message}</p>
                    <AppLink href="/timeline" className="mt-5 inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">
                        タイムラインへ
                    </AppLink>
                </section>
            </main>
        )
    }

    const authorName = diary.author?.display_name ?? '名無し'
    const isOwnDiary = user?.id === diary.user_id

    return (
        <main className="min-h-screen bg-[#f6f1e8]">
            <AppHeader
                actions={
                    <>
                        <AppLink href="/write" className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">
                            書く
                        </AppLink>
                        <button
                            onClick={() => setIsLogoutConfirmOpen(true)}
                            className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-950"
                        >
                            ログアウト
                        </button>
                    </>
                }
            />

            <article className="mx-auto max-w-3xl px-4 pb-36 pt-8 sm:pb-8">
                <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-10">
                    <div className="mb-8 flex items-center gap-3">
                        <Avatar profile={diary.author} fallback={authorName} size="lg" />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-bold text-zinc-950">{authorName}</p>
                                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                                    {diary.is_shared ? 'みんなに共有' : '自分だけ'}
                                </span>
                            </div>
                            <p className="mt-1 text-sm text-zinc-500">{formatDateTime(diary.created_at)}</p>
                        </div>
                    </div>

                    {message && (
                        <p className="mb-5 rounded-xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-100">
                            {message}
                        </p>
                    )}

                    {isOwnDiary && (
                        <div className="mb-8 flex justify-end">
                            <button
                                onClick={toggleSharing}
                                disabled={isUpdatingShare}
                                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950 disabled:text-zinc-400"
                            >
                                {isUpdatingShare ? '変更中' : diary.is_shared ? '自分だけに戻す' : 'みんなに共有する'}
                            </button>
                        </div>
                    )}

                    <h1 className="mb-8 text-4xl font-bold leading-tight text-zinc-950">{diary.title}</h1>
                    <MarkdownRenderer body={diary.body} />
                </div>
            </article>

            <MobileNav />

            {isLogoutConfirmOpen && (
                <LogoutConfirmDialog
                    onCancel={() => setIsLogoutConfirmOpen(false)}
                    onConfirm={logout}
                />
            )}
        </main>
    )
}
