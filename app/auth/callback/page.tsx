'use client'

import { supabase } from '@/lib/supabase'
import { useEffect } from 'react'

export default function AuthCallbackPage() {
    useEffect(() => {
        const checkUser = async () => {
            const { data, error } = await supabase.auth.getUser()

            console.log(data.user)
            console.log(error)
        }

        checkUser()
    }, [])

    return <main className="p-10">ログイン確認中...</main>
}