'use client'

import { supabase } from '@/lib/supabase'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
    const router = useRouter()

    useEffect(() => {
        const handleCallback = async () => {
            const { error } = await supabase.auth.getSession()

            if (error) {
                router.replace('/?authError=callback_failed')
                return
            }

            router.replace('/')
        }

        handleCallback()
    }, [router])

    return <main className="p-10">ログイン処理中...</main>
}