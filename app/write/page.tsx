'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { syncProfile } from '../utils/profiles'

export default function WritePage() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [message, setMessage] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isHelpOpen, setIsHelpOpen] = useState(false)

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
        const load = async () => {
            const { data } = await supabase.auth.getUser()
            setUser(data.user)

            if (data.user) {
                await syncProfile(data.user)
            }
        }

        load()
    }, [])

    const composedBody = useMemo(() => {
        if (!imageUrl.trim()) {
            return body
        }

        return `${body.trim()}\n\n![日記画像](${imageUrl.trim()})`
    }, [body, imageUrl])

    const createDiary = async () => {
        if (!user) {
            setMessage('ログインしてください')
            return
        }

        if (!title.trim() || !body.trim()) {
            setMessage('タイトルと本文を入力してください')
            return
        }

        setIsSubmitting(true)

        const { error } = await supabase.from('diaries').insert({
            user_id: user.id,
            title: title.trim(),
            body: composedBody,
        })

        setIsSubmitting(false)

        if (error) {
            setMessage(`投稿に失敗しました: ${error.message}`)
            return
        }

        router.push('/timeline')
    }

    const insertMarkdown = (example: string) => {
        setBody((currentBody) => {
            if (!currentBody.trim()) {
                return example
            }

            return `${currentBody.trimEnd()}\n\n${example}`
        })
        setIsHelpOpen(false)
    }

    if (!user) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f6f1e8] px-5">
                <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
                    <p className="font-semibold text-zinc-900">ログインが必要です</p>
                    <Link href="/timeline" className="mt-5 inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">
                        タイムラインへ
                    </Link>
                </section>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-[#f6f1e8]">
            <header className="border-b border-black/5 bg-white/60">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
                    <Link href="/timeline" className="font-bold text-zinc-950">
                        UchiLog
                    </Link>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsHelpOpen(true)}
                            className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950"
                        >
                            書き方ヘルプ
                        </button>
                        <button
                            onClick={createDiary}
                            disabled={isSubmitting}
                            className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-400"
                        >
                            {isSubmitting ? '投稿中' : '投稿する'}
                        </button>
                    </div>
                </div>
            </header>

            <section className="mx-auto grid max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                    <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="タイトル"
                        className="w-full border-b border-zinc-200 px-1 pb-4 text-3xl font-bold text-zinc-950 outline-none placeholder:text-zinc-500"
                    />
                    <input
                        value={imageUrl}
                        onChange={(event) => setImageUrl(event.target.value)}
                        placeholder="画像URL"
                        className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-800 outline-none placeholder:text-zinc-500 focus:border-zinc-400"
                    />
                    <textarea
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        placeholder="# 今日のこと&#10;&#10;本文をMarkdownで書けます。"
                        rows={18}
                        className="w-full resize-y rounded-xl border border-zinc-200 px-4 py-3 leading-7 text-zinc-800 outline-none placeholder:text-zinc-500 focus:border-zinc-400"
                    />
                    {message && <p className="text-sm text-red-600">{message}</p>}
                </div>

                <aside className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                    <p className="mb-4 text-sm font-semibold text-zinc-500">プレビュー</p>
                    <h1 className="mb-5 text-2xl font-bold text-zinc-950">{title || 'タイトル'}</h1>
                    <MarkdownRenderer body={composedBody || '本文のプレビューがここに表示されます。'} />
                </aside>
            </section>

            {isHelpOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden bg-zinc-950/40 px-3 py-5 sm:px-4 sm:py-6">
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="markdown-help-title"
                        className="max-h-[88vh] w-full min-w-0 max-w-2xl overflow-y-auto overflow-x-hidden rounded-2xl bg-white p-4 shadow-xl sm:p-5"
                    >
                        <div className="flex min-w-0 flex-col gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                            <div className="min-w-0">
                                <h2 id="markdown-help-title" className="text-xl font-bold text-zinc-950">
                                    Markdownの書き方
                                </h2>
                                <p className="mt-1 text-sm leading-6 text-zinc-500">
                                    よく使う形だけ覚えれば大丈夫です。例を押すと本文に追加できます。
                                </p>
                            </div>
                            <button
                                onClick={() => setIsHelpOpen(false)}
                                className="w-fit rounded-full border border-zinc-200 px-3 py-1 text-sm font-semibold text-zinc-600 hover:border-zinc-400 hover:text-zinc-950"
                            >
                                閉じる
                            </button>
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
