'use client'

import { useRouter } from 'next/navigation'
import { use, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AppHeader } from '../../components/AppHeader'
import { AppLink } from '../../components/AppLink'
import { Avatar } from '../../components/Avatar'
import { DesktopHeaderActions } from '../../components/DesktopHeaderActions'
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
    const [isDeleting, setIsDeleting] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
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

    const deleteDiary = async () => {
        if (!user || !diary || diary.user_id !== user.id) {
            setMessage('この日記は削除できません')
            return
        }

        setIsDeleting(true)
        setMessage('')

        const { error } = await supabase
            .from('diaries')
            .delete()
            .eq('id', diary.id)
            .eq('user_id', user.id)

        setIsDeleting(false)

        if (error) {
            setMessage(`日記の削除に失敗しました: ${error.message}`)
            return
        }

        setIsDeleteConfirmOpen(false)
        router.replace('/timeline')
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
                    <DesktopHeaderActions onLogout={() => setIsLogoutConfirmOpen(true)} />
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
                        <div className="mb-8 flex flex-wrap justify-end gap-2">
                            <button
                                onClick={toggleSharing}
                                disabled={isUpdatingShare || isDeleting}
                                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950 disabled:text-zinc-400"
                            >
                                {isUpdatingShare ? '変更中' : diary.is_shared ? '自分だけに戻す' : 'みんなに共有する'}
                            </button>
                            <button
                                onClick={() => setIsDeleteConfirmOpen(true)}
                                disabled={isDeleting || isUpdatingShare}
                                className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:text-red-300"
                            >
                                削除
                            </button>
                        </div>
                    )}

                    <h1 className="mb-8 text-4xl font-bold leading-tight text-zinc-950">{diary.title}</h1>
                    <MarkdownRenderer body={diary.body} imageOwnerId={diary.user_id} />
                </div>
            </article>

            <MobileNav />

            {isLogoutConfirmOpen && (
                <LogoutConfirmDialog
                    onCancel={() => setIsLogoutConfirmOpen(false)}
                    onConfirm={logout}
                />
            )}

            {isDeleteConfirmOpen && (
                <div
                    onClick={() => {
                        if (!isDeleting) {
                            setIsDeleteConfirmOpen(false)
                        }
                    }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6"
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-diary-title"
                        onClick={(event) => event.stopPropagation()}
                        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
                    >
                        <h2 id="delete-diary-title" className="text-lg font-bold text-zinc-950">
                            日記を削除しますか？
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-zinc-500">
                            削除した日記はタイムラインや詳細画面から見られなくなります。
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                onClick={() => setIsDeleteConfirmOpen(false)}
                                disabled={isDeleting}
                                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 disabled:text-zinc-300"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={deleteDiary}
                                disabled={isDeleting}
                                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300"
                            >
                                {isDeleting ? '削除中' : '削除する'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </main>
    )
}
