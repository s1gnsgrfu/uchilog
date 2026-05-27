'use client'

import { supabase } from '@/lib/supabase'

export default function Home() {
    const loginWithDiscord = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: {
                redirectTo: `${location.origin}/auth/callback`,
            },
        })
    }

    return (
        <main className="p-10">
            <button
                onClick={loginWithDiscord}
                className="rounded bg-black px-4 py-2 text-white"
            >
                Discordでログイン
            </button>
        </main>
    )
}