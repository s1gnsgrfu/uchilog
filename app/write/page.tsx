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
                    <button
                        onClick={createDiary}
                        disabled={isSubmitting}
                        className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-400"
                    >
                        {isSubmitting ? '投稿中' : '投稿する'}
                    </button>
                </div>
            </header>

            <section className="mx-auto grid max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                    <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="タイトル"
                        className="w-full border-b border-zinc-200 px-1 pb-4 text-3xl font-bold outline-none placeholder:text-zinc-300"
                    />
                    <input
                        value={imageUrl}
                        onChange={(event) => setImageUrl(event.target.value)}
                        placeholder="画像URL"
                        className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-zinc-400"
                    />
                    <textarea
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        placeholder="# 今日のこと&#10;&#10;本文をMarkdownで書けます。"
                        rows={18}
                        className="w-full resize-y rounded-xl border border-zinc-200 px-4 py-3 leading-7 outline-none focus:border-zinc-400"
                    />
                    {message && <p className="text-sm text-red-600">{message}</p>}
                </div>

                <aside className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                    <p className="mb-4 text-sm font-semibold text-zinc-500">プレビュー</p>
                    <h1 className="mb-5 text-2xl font-bold text-zinc-950">{title || 'タイトル'}</h1>
                    <MarkdownRenderer body={composedBody || '本文のプレビューがここに表示されます。'} />
                </aside>
            </section>
        </main>
    )
}
