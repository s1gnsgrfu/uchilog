'use client'

import { useRouter } from 'next/navigation'
import { use, useCallback, useEffect, useState } from 'react'
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
import type { Diary, DiaryComment, DiaryCommentWithAuthor, DiaryReaction, DiaryReactionSummary, DiaryWithAuthor } from '../../utils/types'

const LIKE_REACTION = 'like'

export default function DiaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [diary, setDiary] = useState<DiaryWithAuthor | null>(null)
    const [message, setMessage] = useState('')
    const [reactionSummary, setReactionSummary] = useState<DiaryReactionSummary>({
        count: 0,
        reactedByCurrentUser: false,
    })
    const [comments, setComments] = useState<DiaryCommentWithAuthor[]>([])
    const [commentBody, setCommentBody] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isUpdatingShare, setIsUpdatingShare] = useState(false)
    const [isUpdatingReaction, setIsUpdatingReaction] = useState(false)
    const [isPostingComment, setIsPostingComment] = useState(false)
    const [deletingCommentIds, setDeletingCommentIds] = useState<string[]>([])
    const [isDeleting, setIsDeleting] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

    const fetchComments = useCallback(async (diaryId: string) => {
        const { data, error } = await supabase
            .from('diary_comments')
            .select('id,diary_id,user_id,body,created_at,updated_at')
            .eq('diary_id', diaryId)
            .order('created_at', { ascending: true })

        if (error) {
            throw error
        }

        const commentRows = (data ?? []) as DiaryComment[]
        const profileMap = await fetchProfilesByIds(commentRows.map((comment) => comment.user_id))

        return commentRows.map((comment) => ({
            ...comment,
            author: profileMap.get(comment.user_id) ?? null,
        }))
    }, [])

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
            const [{ data: reactionData, error: reactionError }, profileMap, diaryComments] = await Promise.all([
                supabase
                    .from('diary_reactions')
                    .select('diary_id,user_id,reaction,created_at')
                    .eq('diary_id', diaryRow.id)
                    .eq('reaction', LIKE_REACTION),
                fetchProfilesByIds([diaryRow.user_id]),
                fetchComments(diaryRow.id).catch(() => []),
            ])

            if (reactionError) {
                setMessage(`リアクションの取得に失敗しました: ${reactionError.message}`)
                setIsLoading(false)
                return
            }

            const reactions = (reactionData ?? []) as DiaryReaction[]

            setDiary({
                ...diaryRow,
                author: profileMap.get(diaryRow.user_id) ?? null,
            })
            setReactionSummary({
                count: reactions.length,
                reactedByCurrentUser: reactions.some((reaction) => reaction.user_id === sessionData.session?.user.id),
            })
            setComments(diaryComments)
            setIsLoading(false)
        }

        load()
    }, [fetchComments, id])

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

    const toggleReaction = async () => {
        if (!user || !diary || isUpdatingReaction) {
            return
        }

        setIsUpdatingReaction(true)
        setMessage('')

        const reactionQuery = supabase.from('diary_reactions')
        const { error } = reactionSummary.reactedByCurrentUser
            ? await reactionQuery
                .delete()
                .eq('diary_id', diary.id)
                .eq('user_id', user.id)
                .eq('reaction', LIKE_REACTION)
            : await reactionQuery
                .insert({
                    diary_id: diary.id,
                    user_id: user.id,
                    reaction: LIKE_REACTION,
                })

        setIsUpdatingReaction(false)

        if (error) {
            setMessage(`リアクションの更新に失敗しました: ${error.message}`)
            return
        }

        setReactionSummary((current) => {
            const nextReacted = !current.reactedByCurrentUser

            return {
                count: Math.max(0, current.count + (nextReacted ? 1 : -1)),
                reactedByCurrentUser: nextReacted,
            }
        })
    }

    const createComment = async () => {
        if (!user || !diary || isPostingComment) {
            return
        }

        const trimmedBody = commentBody.trim()

        if (!trimmedBody) {
            setMessage('コメントを入力してください')
            return
        }

        if (trimmedBody.length > 1000) {
            setMessage('コメントは1000文字以内で入力してください')
            return
        }

        setIsPostingComment(true)
        setMessage('')

        const { data, error } = await supabase
            .from('diary_comments')
            .insert({
                diary_id: diary.id,
                user_id: user.id,
                body: trimmedBody,
            })
            .select('id,diary_id,user_id,body,created_at,updated_at')
            .single()

        setIsPostingComment(false)

        if (error) {
            setMessage(`コメントの投稿に失敗しました: ${error.message}`)
            return
        }

        const profileMap = await fetchProfilesByIds([user.id])
        const nextComment = data as DiaryComment

        setComments((currentComments) => [
            ...currentComments,
            {
                ...nextComment,
                author: profileMap.get(user.id) ?? null,
            },
        ])
        setCommentBody('')
    }

    const deleteComment = async (commentId: string) => {
        if (!user || deletingCommentIds.includes(commentId)) {
            return
        }

        setDeletingCommentIds((currentIds) => [...currentIds, commentId])
        setMessage('')

        const { error } = await supabase
            .from('diary_comments')
            .delete()
            .eq('id', commentId)
            .eq('user_id', user.id)

        setDeletingCommentIds((currentIds) => currentIds.filter((currentId) => currentId !== commentId))

        if (error) {
            setMessage(`コメントの削除に失敗しました: ${error.message}`)
            return
        }

        setComments((currentComments) => currentComments.filter((comment) => comment.id !== commentId))
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
                    <div className="mt-8 border-t border-zinc-100 pt-5">
                        <button
                            type="button"
                            onClick={() => void toggleReaction()}
                            disabled={isUpdatingReaction}
                            aria-pressed={reactionSummary.reactedByCurrentUser}
                            aria-label={reactionSummary.reactedByCurrentUser ? 'いいねを取り消す' : 'いいねする'}
                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-sm ring-1 transition disabled:opacity-60 ${
                                reactionSummary.reactedByCurrentUser
                                    ? 'bg-amber-100 text-amber-800 ring-amber-200 hover:bg-amber-200'
                                    : 'bg-white text-zinc-500 ring-zinc-200 hover:text-zinc-950'
                            }`}
                        >
                            <span aria-hidden="true">👍</span>
                            <span>{reactionSummary.count}</span>
                        </button>
                    </div>

                    <section className="mt-8 border-t border-zinc-100 pt-6">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-lg font-bold text-zinc-950">コメント</h2>
                            <p className="text-xs font-semibold text-zinc-500">{comments.length}件</p>
                        </div>

                        <div className="mt-4 space-y-4">
                            {comments.length === 0 ? (
                                <p className="rounded-2xl bg-zinc-50 px-4 py-5 text-sm text-zinc-500">
                                    まだコメントはありません。
                                </p>
                            ) : (
                                comments.map((comment) => {
                                    const commentAuthorName = comment.author?.display_name ?? '名無し'
                                    const isOwnComment = comment.user_id === user?.id
                                    const isDeletingComment = deletingCommentIds.includes(comment.id)

                                    return (
                                        <article key={comment.id} className="flex gap-3 rounded-2xl bg-zinc-50 p-4">
                                            <Avatar profile={comment.author} fallback={commentAuthorName} size="sm" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold text-zinc-900">{commentAuthorName}</p>
                                                        <p className="mt-0.5 text-xs text-zinc-500">{formatDateTime(comment.created_at)}</p>
                                                    </div>
                                                    {isOwnComment && (
                                                        <button
                                                            type="button"
                                                            onClick={() => void deleteComment(comment.id)}
                                                            disabled={isDeletingComment}
                                                            className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-500 transition hover:border-red-200 hover:text-red-600 disabled:text-zinc-300"
                                                        >
                                                            {isDeletingComment ? '削除中' : '削除'}
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-700">
                                                    {comment.body}
                                                </p>
                                            </div>
                                        </article>
                                    )
                                })
                            )}
                        </div>

                        <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-3">
                            <textarea
                                value={commentBody}
                                onChange={(event) => {
                                    setCommentBody(event.target.value)
                                    if (message === 'コメントを入力してください' || message === 'コメントは1000文字以内で入力してください') {
                                        setMessage('')
                                    }
                                }}
                                maxLength={1000}
                                rows={3}
                                placeholder="コメントを書く"
                                disabled={isPostingComment}
                                className="min-h-24 w-full resize-y rounded-xl border border-zinc-200 px-3 py-2 text-sm leading-7 text-zinc-800 outline-none placeholder:text-zinc-500 focus:border-zinc-400 disabled:bg-zinc-50"
                            />
                            <div className="mt-2 flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold text-zinc-400">{commentBody.trim().length}/1000</p>
                                <button
                                    type="button"
                                    onClick={() => void createComment()}
                                    disabled={isPostingComment || !commentBody.trim()}
                                    className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-300"
                                >
                                    {isPostingComment ? '投稿中' : 'コメントする'}
                                </button>
                            </div>
                        </div>
                    </section>
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
