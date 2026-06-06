'use client'

import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Avatar } from '../../components/Avatar'
import { MarkdownRenderer } from '../../components/MarkdownRenderer'
import { formatDateTime } from '../../utils/format'
import { fetchProfilesByIds } from '../../utils/profiles'
import type { Diary, DiaryWithAuthor } from '../../utils/types'

export default function DiaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [diary, setDiary] = useState<DiaryWithAuthor | null>(null)
    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
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
                    <Link href="/timeline" className="mt-5 inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">
                        タイムラインへ
                    </Link>
                </section>
            </main>
        )
    }

    const authorName = diary.author?.display_name ?? '名無し'

    return (
        <main className="min-h-screen bg-[#f6f1e8]">
            <header className="border-b border-black/5 bg-white/60">
                <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
                    <Link href="/timeline" className="font-bold text-zinc-950">
                        UchiLog
                    </Link>
                    <Link href="/write" className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">
                        書く
                    </Link>
                </div>
            </header>

            <article className="mx-auto max-w-3xl px-4 py-8">
                <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-10">
                    <div className="mb-8 flex items-center gap-3">
                        <Avatar profile={diary.author} fallback={authorName} size="lg" />
                        <div>
                            <p className="font-bold text-zinc-950">{authorName}</p>
                            <p className="text-sm text-zinc-500">{formatDateTime(diary.created_at)}</p>
                        </div>
                    </div>

                    <h1 className="mb-8 text-4xl font-bold leading-tight text-zinc-950">{diary.title}</h1>
                    <MarkdownRenderer body={diary.body} />
                </div>
            </article>
        </main>
    )
}
