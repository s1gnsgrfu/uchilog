'use client'

import { supabase } from '@/lib/supabase'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
    const router = useRouter()

    useEffect(() => {
        const handleCallback = async () => {
            const { data, error } = await supabase.auth.getSession()

            if (error || !data.session) {
                router.replace('/timeline?authError=callback_failed')
                return
            }

            const providerToken = data.session.provider_token

            if (!providerToken) {
                await supabase.auth.signOut()
                router.replace('/timeline?authError=discord_scope_missing')
                return
            }

            const guildResponse = await fetch('/api/auth/discord-guild', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ providerToken }),
            })

            const guildResult = await guildResponse.json().catch(() => null) as { allowed?: boolean } | null

            if (!guildResponse.ok || !guildResult?.allowed) {
                await supabase.auth.signOut()
                router.replace('/timeline?authError=discord_guild_required')
                return
            }

            router.replace('/')
        }

        handleCallback()
    }, [router])

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#f6f1e8] px-5">
            <section className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
                <p className="text-sm font-semibold text-emerald-700">UchiLog</p>
                <h1 className="mt-2 text-2xl font-bold text-zinc-950">ログインしています</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                    タイムラインへ戻る準備をしています。
                </p>
                <div className="mt-6 flex justify-center">
                    <div
                        aria-label="読み込み中"
                        className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-950"
                    />
                </div>
            </section>
        </main>
    )
}
