'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AppHeader } from '../components/AppHeader'
import { Avatar } from '../components/Avatar'
import { LogoutConfirmDialog } from '../components/LogoutConfirmDialog'
import { MobileNav } from '../components/MobileNav'
import { syncProfile } from '../utils/profiles'
import type { Profile } from '../utils/types'

export default function MenuPage() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [displayName, setDisplayName] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')
    const [bio, setBio] = useState('')
    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isEditingProfile, setIsEditingProfile] = useState(false)
    const [isSavingProfile, setIsSavingProfile] = useState(false)
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

    const setProfileForm = (nextProfile: Profile | null) => {
        setProfile(nextProfile)
        setDisplayName(nextProfile?.display_name ?? '')
        setAvatarUrl(nextProfile?.avatar_url ?? '')
        setBio(nextProfile?.bio ?? '')
    }

    useEffect(() => {
        let isMounted = true

        const load = async () => {
            try {
                const { data } = await supabase.auth.getSession()
                const sessionUser = data.session?.user ?? null

                if (!isMounted) {
                    return
                }

                setUser(sessionUser)

                if (!sessionUser) {
                    return
                }

                const syncedProfile = await syncProfile(sessionUser)

                if (!isMounted) {
                    return
                }

                setProfileForm(syncedProfile)
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : '不明なエラー'
                setMessage(`プロフィールの読み込みに失敗しました: ${errorMessage}`)
            } finally {
                if (isMounted) {
                    setIsLoading(false)
                }
            }
        }

        load()

        return () => {
            isMounted = false
        }
    }, [])

    const saveProfile = async () => {
        if (!user) {
            setMessage('ログインしてください')
            return
        }

        if (!displayName.trim()) {
            setMessage('表示名を入力してください')
            return
        }

        setIsSavingProfile(true)

        const { data, error } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                display_name: displayName.trim(),
                avatar_url: avatarUrl.trim() || null,
                bio: bio.trim() || null,
                updated_at: new Date().toISOString(),
            })
            .select()
            .single()

        setIsSavingProfile(false)

        if (error) {
            setMessage(`プロフィールの保存に失敗しました: ${error.message}`)
            return
        }

        setProfileForm(data)
        setIsEditingProfile(false)
        setMessage('プロフィールを保存しました')
    }

    const logout = async () => {
        const { error } = await supabase.auth.signOut()

        if (error) {
            setMessage('ログアウトに失敗しました')
            return
        }

        setUser(null)
        setIsLogoutConfirmOpen(false)
        router.replace('/timeline')
    }

    if (!isLoading && !user) {
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

    const profileName = profile?.display_name ?? user?.email ?? '名無し'

    return (
        <main className="min-h-screen bg-[#f6f1e8]">
            <AppHeader
                actions={
                    <button
                        onClick={() => setIsLogoutConfirmOpen(true)}
                        className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-950"
                    >
                        ログアウト
                    </button>
                }
            />

            <section className="mx-auto max-w-3xl space-y-5 px-4 pb-28 pt-6 sm:pb-8">
                {message && (
                    <p className="rounded-xl bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm ring-1 ring-black/5">
                        {message}
                    </p>
                )}

                <button
                    onClick={() => setIsEditingProfile((isEditing) => !isEditing)}
                    className="w-full rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                    <div className="flex items-center gap-4">
                        <Avatar profile={profile} fallback={profileName} size="lg" />
                        <div className="min-w-0">
                            <p className="truncate text-lg font-bold text-zinc-950">{profileName}</p>
                            <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-500">
                                {profile?.bio || 'プロフィールを編集'}
                            </p>
                        </div>
                    </div>
                </button>

                {isEditingProfile && (
                    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                        <h1 className="text-xl font-bold text-zinc-950">プロフィール編集</h1>
                        <input
                            value={displayName}
                            onChange={(event) => setDisplayName(event.target.value)}
                            placeholder="表示名"
                            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-zinc-800 outline-none placeholder:text-zinc-500 focus:border-zinc-400"
                        />
                        <input
                            value={avatarUrl}
                            onChange={(event) => setAvatarUrl(event.target.value)}
                            placeholder="アバターURL"
                            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-zinc-800 outline-none placeholder:text-zinc-500 focus:border-zinc-400"
                        />
                        <textarea
                            value={bio}
                            onChange={(event) => setBio(event.target.value)}
                            placeholder="自己紹介"
                            rows={4}
                            className="w-full resize-y rounded-xl border border-zinc-200 px-4 py-3 leading-7 text-zinc-800 outline-none placeholder:text-zinc-500 focus:border-zinc-400"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setProfileForm(profile)
                                    setIsEditingProfile(false)
                                }}
                                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-400 hover:text-zinc-950"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={saveProfile}
                                disabled={isSavingProfile}
                                className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:bg-zinc-400"
                            >
                                {isSavingProfile ? '保存中' : '保存'}
                            </button>
                        </div>
                    </section>
                )}

                <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                    <h2 className="text-lg font-bold text-zinc-950">アプリについて</h2>
                    <p className="text-sm leading-7 text-zinc-600">
                        UchiLogは、身内で日記を共有するためのライフログサービスです。
                        タイムラインではタイトルだけを気軽に眺めて、詳細では本文をゆっくり読めます。<br></br>
                        Copyright © 2026 s1gnsgrfu. All rights reserved.
                    </p>
                </section>

                <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                    <button
                        onClick={() => setIsLogoutConfirmOpen(true)}
                        className="w-full rounded-full border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 hover:border-red-300 hover:bg-red-50"
                    >
                        ログアウト
                    </button>
                </section>
            </section>

            {isLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-5 backdrop-blur-[1px]">
                    <div
                        aria-label="読み込み中"
                        className="h-10 w-10 animate-spin rounded-full border-4 border-white/60 border-t-zinc-950"
                    />
                </div>
            )}

            <MobileNav active="menu" />

            {isLogoutConfirmOpen && (
                <LogoutConfirmDialog
                    onCancel={() => setIsLogoutConfirmOpen(false)}
                    onConfirm={logout}
                />
            )}
        </main>
    )
}
