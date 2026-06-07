'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { AppHeader } from '../components/AppHeader'
import { AppLink } from '../components/AppLink'
import { DesktopHeaderActions } from '../components/DesktopHeaderActions'
import { LogoutConfirmDialog } from '../components/LogoutConfirmDialog'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { MobileNav } from '../components/MobileNav'
import { compressDiaryImage } from '../utils/imageCompression'
import { syncProfile } from '../utils/profiles'

export default function WritePage() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [selectedImage, setSelectedImage] = useState<File | null>(null)
    const [imagePreviewUrl, setImagePreviewUrl] = useState('')
    const [isShared, setIsShared] = useState(true)
    const [message, setMessage] = useState('')
    const [fieldErrors, setFieldErrors] = useState({ title: '', body: '' })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isProcessingImage, setIsProcessingImage] = useState(false)
    const [isHelpOpen, setIsHelpOpen] = useState(false)
    const [isCheckingAuth, setIsCheckingAuth] = useState(true)
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

    const markdownTips = [
        {
            label: '見出し',
            description: '話題を区切る大きなタイトルになります。',
            example: '## 今日のハイライト',
        },
        {
            label: '太字',
            description: '大事な言葉を強調できます。',
            example: '**これは大事**',
        },
        {
            label: 'リスト',
            description: 'できごとを箇条書きにできます。',
            example: '- 朝に散歩した\n- お昼に友だちと話した',
        },
        {
            label: '引用',
            description: '誰かの言葉や印象に残った一文に使えます。',
            example: '> 今日はよくがんばった',
        },
        {
            label: '画像',
            description: '画像URLを本文の好きな位置に入れられます。',
            example: '![写真の説明](https://example.com/image.jpg)',
        },
        {
            label: 'コード',
            description: 'メモしたコマンドやコードを読みやすく表示します。',
            example: '```\nnpm run dev\n```',
        },
    ]

    useEffect(() => {
        let isMounted = true

        const load = async () => {
            try {
                const { data } = await supabase.auth.getSession()
                const sessionUser = data.session?.user ?? null

                if (!isMounted) {
                    return
                }

                setUser(sessionUser)

                if (sessionUser) {
                    await syncProfile(sessionUser)
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : '不明なエラー'
                setMessage(`ログイン状態の確認に失敗しました: ${errorMessage}`)
                setUser(null)
            } finally {
                if (isMounted) {
                    setIsCheckingAuth(false)
                }
            }
        }

        load()

        return () => {
            isMounted = false
        }
    }, [])

    useEffect(() => {
        if (!imagePreviewUrl) {
            return
        }

        return () => {
            URL.revokeObjectURL(imagePreviewUrl)
        }
    }, [imagePreviewUrl])

    const previewBody = useMemo(() => body, [body])

    const uploadSelectedImage = async () => {
        if (!selectedImage) {
            return null
        }

        const { data } = await supabase.auth.getSession()
        const accessToken = data.session?.access_token

        if (!accessToken) {
            throw new Error('ログインが必要です')
        }

        setIsProcessingImage(true)
        const compressed = await compressDiaryImage(selectedImage)
        const formData = new FormData()
        formData.append('thumb', compressed.thumb)
        formData.append('display', compressed.display)
        formData.append('originalName', selectedImage.name)

        const response = await fetch('/api/images/upload', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
        })

        if (!response.ok) {
            throw new Error('画像のアップロードに失敗しました')
        }

        return await response.json() as { thumbUrl: string; displayUrl: string }
    }

    const createDiary = async () => {
        if (!user) {
            setMessage('ログインしてください')
            return
        }

        const nextFieldErrors = {
            title: title.trim() ? '' : 'タイトルを入力してください',
            body: body.trim() ? '' : '本文を入力してください',
        }

        if (nextFieldErrors.title || nextFieldErrors.body) {
            setFieldErrors(nextFieldErrors)
            setMessage('未入力の項目があります')
            return
        }

        setFieldErrors({ title: '', body: '' })
        setMessage('')
        setIsSubmitting(true)

        try {
            const uploadedImage = await uploadSelectedImage()
            const finalBody = uploadedImage
                ? `${body.trim()}\n\n![日記画像](${uploadedImage.displayUrl})`
                : body.trim()

            const { error } = await supabase.from('diaries').insert({
                user_id: user.id,
                title: title.trim(),
                body: finalBody,
                is_shared: isShared,
            })

            if (error) {
                setMessage(`投稿に失敗しました: ${error.message}`)
                return
            }

            router.push('/timeline')
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '投稿に失敗しました'
            setMessage(errorMessage)
        } finally {
            setIsSubmitting(false)
            setIsProcessingImage(false)
        }
    }

    const insertMarkdown = (example: string) => {
        setBody((currentBody) => {
            if (!currentBody.trim()) {
                return example
            }

            return `${currentBody.trimEnd()}\n\n${example}`
        })
        setFieldErrors((currentErrors) => ({ ...currentErrors, body: '' }))
        setMessage('')
        setIsHelpOpen(false)
    }

    const logout = async () => {
        const { error } = await supabase.auth.signOut()

        if (error) {
            setMessage('ログアウトに失敗しました')
            return
        }

        setUser(null)
        setIsLogoutConfirmOpen(false)
        router.replace('/timeline')
    }

    if (!isCheckingAuth && !user) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f6f1e8] px-5">
                <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
                    <p className="font-semibold text-zinc-900">ログインが必要です</p>
                    <AppLink href="/timeline" className="mt-5 inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">
                        タイムラインへ
                    </AppLink>
                </section>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-[#f6f1e8]">
            <AppHeader
                actions={
                    <DesktopHeaderActions showWrite={false} onLogout={() => setIsLogoutConfirmOpen(true)} />
                }
            />

            <section className="mx-auto grid max-w-5xl gap-5 px-4 pb-36 pt-6 sm:pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                    <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-zinc-950">日記を書く</h1>
                            <p className="mt-1 text-sm text-zinc-500">タイトルと本文を、ゆっくり書けます。</p>
                        </div>
                        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                            <button
                                onClick={() => setIsHelpOpen(true)}
                                disabled={isCheckingAuth}
                                className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950"
                            >
                                書き方ヘルプ
                            </button>
                            <button
                                onClick={createDiary}
                                disabled={isSubmitting || isProcessingImage || isCheckingAuth}
                                className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-400"
                            >
                                {isProcessingImage ? '画像処理中' : isSubmitting ? '投稿中' : '投稿する'}
                            </button>
                        </div>
                    </div>
                    {message && (
                        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                            {message}
                        </p>
                    )}
                    <input
                        value={title}
                        onChange={(event) => {
                            setTitle(event.target.value)
                            if (fieldErrors.title) {
                                setFieldErrors((currentErrors) => ({ ...currentErrors, title: '' }))
                            }
                            if (message === '未入力の項目があります') {
                                setMessage('')
                            }
                        }}
                        placeholder="タイトル"
                        disabled={isCheckingAuth}
                        aria-invalid={Boolean(fieldErrors.title)}
                        className={`w-full border-b px-1 pb-4 text-3xl font-bold text-zinc-950 outline-none placeholder:text-zinc-500 ${
                            fieldErrors.title ? 'border-red-400' : 'border-zinc-200'
                        }`}
                    />
                    {fieldErrors.title && <p className="-mt-2 text-sm font-semibold text-red-600">{fieldErrors.title}</p>}
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-bold text-zinc-900">サムネイル</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <label className="cursor-pointer rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950">
                                    画像を選択
                                    <input
                                        type="file"
                                        accept="image/*"
                                        disabled={isCheckingAuth || isSubmitting}
                                        onChange={(event) => {
                                            const file = event.target.files?.[0] ?? null
                                            setSelectedImage(file)
                                            setImagePreviewUrl(file ? URL.createObjectURL(file) : '')
                                            event.target.value = ''
                                        }}
                                        className="sr-only"
                                    />
                                </label>
                                {selectedImage && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedImage(null)
                                            setImagePreviewUrl('')
                                        }}
                                        disabled={isCheckingAuth || isSubmitting}
                                        className="rounded-full px-3 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-950"
                                    >
                                        削除
                                    </button>
                                )}
                            </div>
                        </div>
                        {selectedImage && (
                            <div className="mt-4 flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-black/5">
                                {imagePreviewUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={imagePreviewUrl}
                                        alt=""
                                        className="h-16 w-16 shrink-0 rounded-lg object-cover"
                                    />
                                )}
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-zinc-900">{selectedImage.name}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                        <input
                            type="checkbox"
                            checked={isShared}
                            onChange={(event) => setIsShared(event.target.checked)}
                            disabled={isCheckingAuth}
                            className="mt-1 h-4 w-4 accent-zinc-950"
                        />
                        <span className="min-w-0">
                            <span className="block text-sm font-bold text-zinc-900">みんなに共有する</span>
                            <span className="mt-1 block text-sm leading-6 text-zinc-500">
                                オンにすると、タイムラインで他のメンバーにも表示されます。
                            </span>
                        </span>
                    </label>
                    {fieldErrors.body && <p className="text-sm font-semibold text-red-600">{fieldErrors.body}</p>}
                    <textarea
                        value={body}
                        onChange={(event) => {
                            setBody(event.target.value)
                            if (fieldErrors.body) {
                                setFieldErrors((currentErrors) => ({ ...currentErrors, body: '' }))
                            }
                            if (message === '未入力の項目があります') {
                                setMessage('')
                            }
                        }}
                        placeholder="# 今日のこと&#10;&#10;本文をMarkdownで書けます。"
                        rows={18}
                        disabled={isCheckingAuth}
                        aria-invalid={Boolean(fieldErrors.body)}
                        className={`h-56 w-full resize-y rounded-xl border px-4 py-3 leading-7 text-zinc-800 outline-none placeholder:text-zinc-500 focus:border-zinc-400 sm:h-auto ${
                            fieldErrors.body ? 'border-red-400' : 'border-zinc-200'
                        }`}
                    />
                </div>

                <aside className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                    <p className="mb-4 text-sm font-semibold text-zinc-500">プレビュー</p>
                    <p className="mb-3 inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                        {isShared ? 'みんなに共有' : '自分だけ'}
                    </p>
                    <h1 className="mb-5 text-2xl font-bold text-zinc-950">{title || 'タイトル'}</h1>
                    {imagePreviewUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={imagePreviewUrl}
                            alt=""
                            className="mb-5 max-h-64 w-full rounded-xl object-cover"
                        />
                    )}
                    <MarkdownRenderer body={previewBody || '本文のプレビューがここに表示されます。'} />
                </aside>
            </section>

            {isCheckingAuth && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-5 backdrop-blur-[1px]">
                    <div
                        aria-label="読み込み中"
                        className="h-10 w-10 animate-spin rounded-full border-4 border-white/60 border-t-zinc-950"
                    />
                </div>
            )}

            <MobileNav active="write" />

            {isLogoutConfirmOpen && (
                <LogoutConfirmDialog
                    onCancel={() => setIsLogoutConfirmOpen(false)}
                    onConfirm={logout}
                />
            )}

            {isHelpOpen && (
                <div
                    onClick={() => setIsHelpOpen(false)}
                    className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden bg-zinc-950/40 px-3 py-5 sm:px-4 sm:py-6"
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="markdown-help-title"
                        onClick={(event) => event.stopPropagation()}
                        className="relative max-h-[88vh] w-full min-w-0 max-w-2xl overflow-y-auto overflow-x-hidden rounded-2xl bg-white p-4 shadow-xl sm:p-5"
                    >
                        <button
                            onClick={() => setIsHelpOpen(false)}
                            aria-label="書き方ヘルプを閉じる"
                            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-xl font-semibold leading-none text-zinc-600 shadow-sm hover:border-zinc-400 hover:text-zinc-950"
                        >
                            ×
                        </button>

                        <div className="flex min-w-0 flex-col gap-3 border-b border-zinc-100 pb-4 pr-11 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                            <div className="min-w-0">
                                <h2 id="markdown-help-title" className="text-xl font-bold text-zinc-950">
                                    Markdownの書き方
                                </h2>
                                <p className="mt-1 text-sm leading-6 text-zinc-500">
                                    よく使う形だけ覚えれば大丈夫です。例を押すと本文に追加できます。
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                            {markdownTips.map((tip) => (
                                <article key={tip.label} className="min-w-0 rounded-xl border border-zinc-200 p-4">
                                    <div className="flex min-w-0 items-center justify-between gap-3">
                                        <h3 className="font-bold text-zinc-950">{tip.label}</h3>
                                        <button
                                            onClick={() => insertMarkdown(tip.example)}
                                            className="shrink-0 rounded-full bg-zinc-950 px-3 py-1 text-xs font-semibold text-white hover:bg-zinc-800"
                                        >
                                            入れる
                                        </button>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-zinc-500">{tip.description}</p>
                                    <pre className="mt-3 min-w-0 whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-3 text-sm text-zinc-800">
                                        <code className="break-words">{tip.example}</code>
                                    </pre>
                                </article>
                            ))}
                        </div>
                    </section>
                </div>
            )}
        </main>
    )
}
