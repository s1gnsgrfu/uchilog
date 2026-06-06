'use client'

import { supabase } from '@/lib/supabase'
import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

export default function Home() {
    const [user, setUser] = useState<User | null>(null)
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [message, setMessage] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const [editBody, setEditBody] = useState('')
    const [savingId, setSavingId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [profileDisplayName, setProfileDisplayName] = useState('')
    const [profileBio, setProfileBio] = useState('')
    const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
    const [isSavingProfile, setIsSavingProfile] = useState(false)
    type Profile = {
        id: string
        display_name: string | null
        avatar_url: string | null
        bio: string | null
        created_at: string
        updated_at: string
    }
    type Diary = {
        id: string
        user_id: string
        title: string
        body: string
        created_at: string
        updated_at: string
    }
    const [diaries, setDiaries] = useState<Diary[]>([])

    const setProfileForm = useCallback((nextProfile: Profile) => {
        setProfile(nextProfile)
        setProfileDisplayName(nextProfile.display_name ?? '')
        setProfileBio(nextProfile.bio ?? '')
        setProfileAvatarUrl(nextProfile.avatar_url ?? '')
    }, [])

    const syncProfile = useCallback(async (currentUser: User) => {
        const { data: existingProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle()

        if (fetchError) {
            setMessage(`プロフィールの取得に失敗しました: ${fetchError.message}`)
            return
        }

        if (existingProfile) {
            setProfileForm(existingProfile)
            return
        }

        const metadata = currentUser.user_metadata as {
            avatar_url?: string
            full_name?: string
            name?: string
            picture?: string
        }

        const { data: createdProfile, error: insertError } = await supabase
            .from('profiles')
            .upsert({
                id: currentUser.id,
                display_name: metadata.full_name ?? metadata.name ?? currentUser.email ?? '名無し',
                avatar_url: metadata.avatar_url ?? metadata.picture ?? null,
            }, {
                ignoreDuplicates: true,
                onConflict: 'id',
            })
            .select()
            .maybeSingle()

        if (insertError) {
            setMessage(`プロフィールの作成に失敗しました: ${insertError.message}`)
            return
        }

        if (createdProfile) {
            setProfileForm(createdProfile)
            return
        }

        const { data: duplicateProfile, error: duplicateFetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle()

        if (duplicateFetchError) {
            setMessage(`プロフィールの再取得に失敗しました: ${duplicateFetchError.message}`)
            return
        }

        if (duplicateProfile) {
            setProfileForm(duplicateProfile)
        }
    }, [setProfileForm])

    const fetchDiaries = useCallback(async () => {
        const { data, error } = await supabase
            .from('diaries')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            setMessage(`日記の取得に失敗しました: ${error.message}`)
            return
        }

        setDiaries(data ?? [])
    }, [])

    useEffect(() => {
        const getUser = async () => {
            const { data, error } = await supabase.auth.getUser()

            if (error) {
                setUser(null)
                return
            }

            setUser(data.user)
            if (data.user) {
                await syncProfile(data.user)
                await fetchDiaries()
            }
        }

        getUser()
    }, [fetchDiaries, syncProfile])

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
        setProfile(null)
        setDiaries([])
        cancelEdit()
    }

    const updateProfile = async () => {
        if (!user) {
            setMessage('ログインしてください')
            return
        }

        if (!profileDisplayName.trim()) {
            setMessage('表示名を入力してください')
            return
        }

        setIsSavingProfile(true)

        const { data, error } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                display_name: profileDisplayName,
                bio: profileBio || null,
                avatar_url: profileAvatarUrl || null,
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
        setMessage('プロフィールを保存しました')
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
        fetchDiaries()
    }

    const startEdit = (diary: Diary) => {
        setEditingId(diary.id)
        setEditTitle(diary.title)
        setEditBody(diary.body)
        setMessage('')
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditTitle('')
        setEditBody('')
    }

    const updateDiary = async (diaryId: string) => {
        if (!editTitle.trim() || !editBody.trim()) {
            setMessage('タイトルと本文を入力してください')
            return
        }

        setSavingId(diaryId)

        const { error } = await supabase
            .from('diaries')
            .update({
                title: editTitle,
                body: editBody,
                updated_at: new Date().toISOString(),
            })
            .eq('id', diaryId)

        setSavingId(null)

        if (error) {
            setMessage(`更新に失敗しました: ${error.message}`)
            return
        }

        cancelEdit()
        setMessage('更新しました')
        fetchDiaries()
    }

    const deleteDiary = async (diaryId: string) => {
        if (!confirm('この日記を削除しますか？')) {
            return
        }

        setDeletingId(diaryId)

        const { error } = await supabase.from('diaries').delete().eq('id', diaryId)

        setDeletingId(null)

        if (error) {
            setMessage(`削除に失敗しました: ${error.message}`)
            return
        }

        if (editingId === diaryId) {
            cancelEdit()
        }

        setMessage('削除しました')
        fetchDiaries()
    }

    return (
        <main className="mx-auto max-w-2xl space-y-6 p-10">
            <h1 className="text-2xl font-bold">uchilog</h1>

            {user ? (
                <div className="space-y-6">
                    <div className="space-y-2 rounded border p-4">
                        <div className="flex items-center gap-3">
                            {profile?.avatar_url ? (
                                <div
                                    className="h-12 w-12 rounded-full bg-cover bg-center"
                                    style={{ backgroundImage: `url(${profile.avatar_url})` }}
                                />
                            ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-sm text-gray-600">
                                    {profile?.display_name?.slice(0, 1) ?? 'u'}
                                </div>
                            )}
                            <div>
                                <p className="font-bold">{profile?.display_name ?? 'ログイン中'}</p>
                                <p className="text-sm text-gray-600">{profile?.bio ?? 'プロフィール未設定'}</p>
                            </div>
                        </div>
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
                        <h2 className="text-xl font-bold">プロフィール</h2>

                        <input
                            value={profileDisplayName}
                            onChange={(e) => setProfileDisplayName(e.target.value)}
                            placeholder="表示名"
                            className="w-full rounded border p-2"
                        />

                        <input
                            value={profileAvatarUrl}
                            onChange={(e) => setProfileAvatarUrl(e.target.value)}
                            placeholder="アバターURL"
                            className="w-full rounded border p-2"
                        />

                        <textarea
                            value={profileBio}
                            onChange={(e) => setProfileBio(e.target.value)}
                            placeholder="自己紹介"
                            rows={4}
                            className="w-full rounded border p-2"
                        />

                        <button
                            onClick={updateProfile}
                            disabled={isSavingProfile}
                            className="rounded bg-black px-4 py-2 text-white disabled:bg-gray-400"
                        >
                            {isSavingProfile ? '保存中' : 'プロフィールを保存'}
                        </button>
                    </section>

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
                    <section className="space-y-4 rounded border p-4">
                        <h2 className="text-xl font-bold">日記一覧</h2>

                        {diaries.length === 0 ? (
                            <p className="text-sm text-gray-600">まだ日記がありません</p>
                        ) : (
                            <div className="space-y-3">
                                {diaries.map((diary) => (
                                    <article key={diary.id} className="space-y-3 rounded border p-3">
                                        {editingId === diary.id ? (
                                            <>
                                                <input
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    className="w-full rounded border p-2"
                                                />
                                                <textarea
                                                    value={editBody}
                                                    onChange={(e) => setEditBody(e.target.value)}
                                                    rows={6}
                                                    className="w-full rounded border p-2"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => updateDiary(diary.id)}
                                                        disabled={savingId === diary.id}
                                                        className="rounded bg-black px-3 py-2 text-sm text-white disabled:bg-gray-400"
                                                    >
                                                        {savingId === diary.id ? '保存中' : '保存'}
                                                    </button>
                                                    <button
                                                        onClick={cancelEdit}
                                                        className="rounded border px-3 py-2 text-sm"
                                                    >
                                                        キャンセル
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <h3 className="font-bold">{diary.title}</h3>
                                                <p className="whitespace-pre-wrap text-sm">{diary.body}</p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => startEdit(diary)}
                                                        className="rounded border px-3 py-2 text-sm"
                                                    >
                                                        編集
                                                    </button>
                                                    <button
                                                        onClick={() => deleteDiary(diary.id)}
                                                        disabled={deletingId === diary.id}
                                                        className="rounded border border-red-500 px-3 py-2 text-sm text-red-600 disabled:border-gray-300 disabled:text-gray-400"
                                                    >
                                                        {deletingId === diary.id ? '削除中' : '削除'}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </article>
                                ))}
                            </div>
                        )}
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
