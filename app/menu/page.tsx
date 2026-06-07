'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AppHeader } from '../components/AppHeader'
import { AppLink } from '../components/AppLink'
import { Avatar } from '../components/Avatar'
import { DesktopHeaderActions } from '../components/DesktopHeaderActions'
import { LogoutConfirmDialog } from '../components/LogoutConfirmDialog'
import { MobileNav } from '../components/MobileNav'
import { profileFromUserMetadata, syncProfile } from '../utils/profiles'
import type { Profile } from '../utils/types'

const installSteps = [
    {
        title: '共有アイコンをタップ',
        description: 'Safariの下にある共有メニューを開きます。',
        image: {
            src: '/pwa-install/ios-share.png',
            width: 1206,
            height: 1547,
        },
    },
    {
        title: 'ホーム画面に追加をタップ',
        description: '共有メニューの中から「ホーム画面に追加」を選びます。',
        image: {
            src: '/pwa-install/ios-add-to-home.png',
            width: 1206,
            height: 1838,
        },
    },
    {
        title: '追加をタップ',
        description: '右上の「追加」を押すと、ホーム画面からUchiLogを開けます。',
        image: {
            src: '/pwa-install/ios-add.png',
            width: 1206,
            height: 1026,
        },
    },
]

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let index = 0; index < rawData.length; index += 1) {
        outputArray[index] = rawData.charCodeAt(index)
    }

    return outputArray
}

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
    const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false)
    const [installStepIndex, setInstallStepIndex] = useState(0)
    const [touchStartX, setTouchStartX] = useState<number | null>(null)
    const [isNotificationSupported, setIsNotificationSupported] = useState(false)
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
    const [notificationSubscription, setNotificationSubscription] = useState<PushSubscription | null>(null)
    const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false)
    const [notificationMessage, setNotificationMessage] = useState('')

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

    useEffect(() => {
        let isMounted = true

        const setupNotifications = async () => {
            if (!user || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
                setIsNotificationSupported(false)
                return
            }

            setIsNotificationSupported(true)
            setNotificationPermission(Notification.permission)

            try {
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                    updateViaCache: 'none',
                })
                const subscription = await registration.pushManager.getSubscription()

                if (isMounted) {
                    setNotificationSubscription(subscription)
                }
            } catch {
                if (isMounted) {
                    setNotificationMessage('通知の準備に失敗しました')
                }
            }
        }

        void setupNotifications()

        return () => {
            isMounted = false
        }
    }, [user])

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

    const resetProfileFormToDiscord = () => {
        if (!user) {
            setMessage('ログインしてください')
            return
        }

        const defaultProfile = profileFromUserMetadata(user)
        setDisplayName(defaultProfile.display_name)
        setAvatarUrl(defaultProfile.avatar_url ?? '')
        setBio('')
    }

    const getAccessToken = async () => {
        const { data } = await supabase.auth.getSession()
        return data.session?.access_token ?? null
    }

    const enableNotifications = async () => {
        if (!isNotificationSupported) {
            setNotificationMessage('この環境では通知が使えません')
            return
        }

        if (!vapidPublicKey) {
            setNotificationMessage('通知用の公開キーが設定されていません')
            return
        }

        setIsUpdatingNotifications(true)
        setNotificationMessage('')

        try {
            const permission = await Notification.requestPermission()
            setNotificationPermission(permission)

            if (permission !== 'granted') {
                setNotificationMessage('通知が許可されませんでした')
                return
            }

            const accessToken = await getAccessToken()

            if (!accessToken) {
                setNotificationMessage('ログインしてください')
                return
            }

            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            })

            const response = await fetch('/api/push/subscriptions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ subscription }),
            })

            if (!response.ok) {
                await subscription.unsubscribe()
                throw new Error('subscription_save_failed')
            }

            setNotificationSubscription(subscription)
            setNotificationMessage('通知をオンにしました')
        } catch {
            setNotificationMessage('通知をオンにできませんでした')
        } finally {
            setIsUpdatingNotifications(false)
        }
    }

    const disableNotifications = async () => {
        const subscription = notificationSubscription

        if (!subscription) {
            return
        }

        setIsUpdatingNotifications(true)
        setNotificationMessage('')

        try {
            const accessToken = await getAccessToken()

            if (accessToken) {
                await fetch('/api/push/subscriptions', {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                })
            }

            await subscription.unsubscribe()
            setNotificationSubscription(null)
            setNotificationMessage('通知をオフにしました')
        } catch {
            setNotificationMessage('通知をオフにできませんでした')
        } finally {
            setIsUpdatingNotifications(false)
        }
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

    const openInstallGuide = () => {
        setInstallStepIndex(0)
        setIsInstallGuideOpen(true)
    }

    const goToInstallStep = (nextStepIndex: number) => {
        setInstallStepIndex(Math.min(Math.max(nextStepIndex, 0), installSteps.length - 1))
    }

    const handleInstallGuideTouchEnd = (clientX: number) => {
        if (touchStartX === null) {
            return
        }

        const swipeDistance = touchStartX - clientX

        if (Math.abs(swipeDistance) > 40) {
            goToInstallStep(installStepIndex + (swipeDistance > 0 ? 1 : -1))
        }

        setTouchStartX(null)
    }

    if (!isLoading && !user) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f6f1e8] px-5">
                <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
                    <p className="font-semibold text-zinc-900">ログインが必要です</p>
                    <AppLink href="/timeline" className="mt-5 inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">
                        タイムラインへ
                    </AppLink>
                </section>
            </main>
        )
    }

    const profileName = profile?.display_name ?? user?.email ?? '名無し'

    return (
        <main className="min-h-screen bg-[#f6f1e8]">
            <AppHeader
                actions={
                    <DesktopHeaderActions onLogout={() => setIsLogoutConfirmOpen(true)} />
                }
            />

            <section className="mx-auto max-w-3xl space-y-5 px-4 pb-36 pt-6 sm:pb-8">
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
                        <div className="flex items-center justify-between gap-2">
                            <button
                                onClick={resetProfileFormToDiscord}
                                className="shrink-0 rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-400 hover:text-zinc-950"
                            >
                                元に戻す
                            </button>
                            <div className="flex min-w-0 justify-end gap-2">
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
                        </div>
                    </section>
                )}

                <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                    <div>
                        <h2 className="text-lg font-bold text-zinc-950">通知設定</h2>
                        <p className="mt-1 text-sm leading-6 text-zinc-500">
                            他の人が日記を投稿したときに通知を受け取れます。iPhoneではホーム画面に追加したアプリで使えます。
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-700">
                            {notificationSubscription ? '通知はオンです' : '通知はオフです'}
                        </p>
                        <button
                            type="button"
                            onClick={notificationSubscription ? disableNotifications : enableNotifications}
                            disabled={!isNotificationSupported || isUpdatingNotifications || notificationPermission === 'denied'}
                            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:bg-zinc-400"
                        >
                            {isUpdatingNotifications
                                ? '変更中'
                                : notificationSubscription
                                    ? '通知をオフ'
                                    : '通知をオン'}
                        </button>
                    </div>
                    {!isNotificationSupported && (
                        <p className="text-xs font-semibold text-red-600">この環境では通知が使えません。</p>
                    )}
                    {notificationPermission === 'denied' && (
                        <p className="text-xs font-semibold text-red-600">通知がブラウザ側でブロックされています。</p>
                    )}
                    {notificationMessage && (
                        <p className="text-xs font-semibold text-zinc-600">{notificationMessage}</p>
                    )}
                </section>

                <button
                    onClick={openInstallGuide}
                    className="flex w-full items-center justify-between rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                    <span className="min-w-0">
                        <span className="block text-lg font-bold text-zinc-950">アプリとして使うには？</span>
                        <span className="mt-1 block text-sm leading-6 text-zinc-500">
                            iPhoneのホーム画面に追加する手順を確認できます。
                        </span>
                    </span>
                    <span className="shrink-0 pl-3 text-xl text-zinc-400">→</span>
                </button>

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

            {isInstallGuideOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 px-3 py-5 backdrop-blur-[1px] sm:px-5"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="install-guide-title"
                >
                    <section className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-white/20">
                        <div className="border-b border-zinc-100 px-5 py-4">
                            <p className="text-xs font-semibold text-zinc-500">
                                {installStepIndex + 1} / {installSteps.length}
                            </p>
                            <h2 id="install-guide-title" className="mt-1 text-xl font-bold text-zinc-950">
                                {installSteps[installStepIndex].title}
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-zinc-500">
                                {installSteps[installStepIndex].description}
                            </p>
                        </div>

                        <div
                            className="min-h-0 flex-1 overflow-hidden bg-zinc-100"
                            onTouchStart={(event) => setTouchStartX(event.changedTouches[0]?.clientX ?? null)}
                            onTouchEnd={(event) => handleInstallGuideTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
                        >
                            <div
                                className="flex h-full transition-transform duration-300 ease-out"
                                style={{ transform: `translateX(-${installStepIndex * 100}%)` }}
                            >
                                {installSteps.map((step) => (
                                    <div key={step.title} className="flex min-w-full items-center justify-center p-3">
                                        <div className="relative flex h-[54vh] max-h-[560px] min-h-[320px] w-full items-center justify-center sm:h-[600px]">
                                            <Image
                                                src={step.image.src}
                                                alt={step.title}
                                                width={step.image.width}
                                                height={step.image.height}
                                                className="max-h-full w-auto rounded-xl object-contain shadow-sm"
                                                priority={step === installSteps[0]}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4 px-5 py-4">
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => goToInstallStep(installStepIndex - 1)}
                                    disabled={installStepIndex === 0}
                                    className="h-10 w-10 rounded-full border border-zinc-200 text-lg font-semibold text-zinc-700 disabled:text-zinc-300"
                                    aria-label="前の手順"
                                >
                                    ←
                                </button>

                                <div className="flex items-center justify-center gap-2">
                                    {installSteps.map((step, index) => (
                                        <button
                                            key={step.title}
                                            type="button"
                                            onClick={() => goToInstallStep(index)}
                                            className={`h-2.5 rounded-full transition-all ${
                                                index === installStepIndex ? 'w-6 bg-zinc-950' : 'w-2.5 bg-zinc-300'
                                            }`}
                                            aria-label={`${index + 1}番目の手順を表示`}
                                        />
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => goToInstallStep(installStepIndex + 1)}
                                    disabled={installStepIndex === installSteps.length - 1}
                                    className="h-10 w-10 rounded-full border border-zinc-200 text-lg font-semibold text-zinc-700 disabled:text-zinc-300"
                                    aria-label="次の手順"
                                >
                                    →
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsInstallGuideOpen(false)}
                                className="w-full rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
                            >
                                閉じる
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </main>
    )
}
