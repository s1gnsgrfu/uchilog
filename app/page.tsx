'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

export default function Home() {
    const [user, setUser] = useState<User | null>(null)

    useEffect(() => {
        const getUser = async () => {
            const { data, error } = await supabase.auth.getUser()
            if (error) {
                setUser(null)
                alert('ユーザーの情報の取得に失敗しました')
                return
            }
            setUser(data.user)
        }

        getUser()
    }, [])

    const loginWithDiscord = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: {
                redirectTo: `${location.origin}/auth/callback`,
            },
        })

        if (error) {
            alert('ログインに失敗しました')
        }
    }

    const logout = async () => {
        const { error } = await supabase.auth.signOut()

        if (error) {
            alert('ログアウトに失敗しました')
            return
        }

        setUser(null)
    }

    return (
        <main className="p-10">
            {user ? (
                <div className="space-y-4">
                    <p>ログイン中</p>
                    <p>User ID: {user.id}</p>
                    <p>Email: {user.email}</p>
                    <button onClick={logout} className="rounded bg-gray-800 px-4 py-2 text-white">
                        ログアウト
                    </button>
                </div>
            ) : (
                <button onClick={loginWithDiscord} className="rounded bg-black px-4 py-2 text-white">
                    Discordでログイン
                </button>
            )}
        </main>
    )
}