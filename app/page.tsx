'use client'

import { supabase } from '@/lib/supabase'

export default function Home() {
    const testConnection = async () => {
        const { data, error } = await supabase.auth.getSession()

        console.log(data)
        console.log(error)

        alert('Supabase接続OK')
    }

    return (
        <main className="p-10">
            <button
                onClick={testConnection}
                className="rounded bg-black px-4 py-2 text-white"
            >
                接続テスト
            </button>
        </main>
    )
}