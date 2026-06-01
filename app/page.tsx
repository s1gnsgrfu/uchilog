'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

export default function Home() {
    const [user, setUser] = useState<User | null>(null)
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => {
        const getUser = async () => {
            const { data, error } = await supabase.auth.getUser()

            if (error) {
                setUser(null)
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
            setMessage('ログインに失敗しました')
        }
    }

    const logout = async () => {
        const { error } = await supabase.auth.signOut()

        if (error) {
            setMessage('ログアウトに失敗しました')
            return
        }

        setUser(null)
    }

    const createDiary = async () => {
        if (!user) {
            setMessage('ログインしてください')
            return
        }

        if (!title.trim() || !body.trim()) {
            setMessage('タイトルと本文を入力してください')
            return
        }

        const { error } = await supabase.from('diaries').insert({
            user_id: user.id,
            title,
            body,
        })

        if (error) {
            setMessage(`投稿に失敗しました: ${error.message}`)
            return
        }

        setTitle('')
        setBody('')
        setMessage('投稿しました')
    }

    return (
        <main className="mx-auto max-w-2xl space-y-6 p-10">
            <h1 className="text-2xl font-bold">uchilog</h1>

            {user ? (
                <div className="space-y-6">
                    <div className="space-y-2 rounded border p-4">
                        <p>ログイン中</p>
                        <p className="break-all text-sm text-gray-600">User ID: {user.id}</p>
                        <p className="text-sm text-gray-600">Email: {user.email}</p>
                        <button
                            onClick={logout}
                            className="rounded bg-gray-800 px-4 py-2 text-white"
                        >
                            ログアウト
                        </button>
                    </div>

                    <section className="space-y-4 rounded border p-4">
                        <h2 className="text-xl font-bold">日記を書く</h2>

                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="タイトル"
                            className="w-full rounded border p-2"
                        />

                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="本文"
                            rows={8}
                            className="w-full rounded border p-2"
                        />

                        <button
                            onClick={createDiary}
                            className="rounded bg-black px-4 py-2 text-white"
                        >
                            投稿
                        </button>
                    </section>
                </div>
            ) : (
                <button
                    onClick={loginWithDiscord}
                    className="rounded bg-black px-4 py-2 text-white"
                >
                    Discordでログイン
                </button>
            )}

            {message && <p className="text-sm text-blue-600">{message}</p>}
        </main>
    )
}