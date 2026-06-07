import webpush from 'web-push'
import { createAdminClient, getAuthenticatedUserId, type PushSubscriptionRow } from '../_supabase'

type NotifyBody = {
    diaryId?: unknown
}

type DiaryRow = {
    id: string
    user_id: string
    is_shared: boolean
}

type ProfileRow = {
    display_name: string | null
}

type PushErrorLike = {
    statusCode?: number
    body?: unknown
    message?: string
}

function configureWebPush() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const contact = process.env.VAPID_CONTACT_EMAIL ?? 'noreply@uchilog.local'

    if (!publicKey || !privateKey) {
        throw new Error('VAPID env vars are not configured')
    }

    webpush.setVapidDetails(`mailto:${contact}`, publicKey, privateKey)
}

function isExpiredSubscriptionError(error: unknown) {
    return typeof error === 'object'
        && error !== null
        && 'statusCode' in error
        && (error.statusCode === 404 || error.statusCode === 410)
}

function getPushErrorInfo(error: unknown) {
    if (typeof error !== 'object' || error === null) {
        return {
            message: String(error),
        }
    }

    const pushError = error as PushErrorLike

    return {
        statusCode: pushError.statusCode,
        message: pushError.message,
        body: pushError.body,
    }
}

function maskEndpoint(endpoint: string) {
    if (endpoint.length <= 80) {
        return endpoint
    }

    return `${endpoint.slice(0, 60)}...${endpoint.slice(-12)}`
}

export async function POST(request: Request) {
    try {
        const userId = await getAuthenticatedUserId(request)

        if (!userId) {
            return Response.json({ error: 'unauthorized' }, { status: 401 })
        }

        const body = await request.json() as NotifyBody
        const diaryId = typeof body.diaryId === 'string' ? body.diaryId : ''

        if (!diaryId) {
            return Response.json({ error: 'invalid_diary_id' }, { status: 400 })
        }

        const supabase = createAdminClient()

        const { data: diary, error: diaryError } = await supabase
            .from('diaries')
            .select('id,user_id,is_shared')
            .eq('id', diaryId)
            .single<DiaryRow>()

        if (diaryError || !diary || diary.user_id !== userId) {
            console.error('diary_not_found_or_not_owner', {
                userId,
                diaryId,
                diaryError,
                diary,
            })

            return Response.json({ error: 'diary_not_found' }, { status: 404 })
        }

        if (!diary.is_shared) {
            console.log('notification skipped: diary is not shared', {
                diaryId: diary.id,
                userId,
            })

            return Response.json({ ok: true, sent: 0, failed: 0, expired: 0 })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', userId)
            .maybeSingle<ProfileRow>()

        const authorName = profile?.display_name?.trim() || '誰か'

        const { data: subscriptions, error: subscriptionsError } = await supabase
            .from('push_subscriptions')
            .select('id,user_id,endpoint,p256dh,auth')
            .neq('user_id', userId)
            .returns<PushSubscriptionRow[]>()

        if (subscriptionsError) {
            console.error('subscriptions_fetch_failed', subscriptionsError)

            return Response.json({ error: 'subscriptions_fetch_failed' }, { status: 500 })
        }

        if (!subscriptions || subscriptions.length === 0) {
            console.log('notification skipped: no subscriptions', {
                diaryId: diary.id,
                userId,
            })

            return Response.json({ ok: true, sent: 0, failed: 0, expired: 0 })
        }

        configureWebPush()

        const payload = JSON.stringify({
            title: 'UchiLog',
            body: `${authorName}さんが日記を投稿しました！`,
            url: `/diary/${diary.id}`,
        })

        let sent = 0
        let failed = 0
        const expiredSubscriptionIds: string[] = []

        console.log('notification start', {
            diaryId: diary.id,
            senderUserId: userId,
            targetCount: subscriptions.length,
            targets: subscriptions.map((subscription) => ({
                id: subscription.id,
                userId: subscription.user_id,
                endpoint: maskEndpoint(subscription.endpoint),
                isApple: subscription.endpoint.startsWith('https://web.push.apple.com/'),
            })),
        })

        await Promise.all(subscriptions.map(async (subscription) => {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: subscription.endpoint,
                        keys: {
                            p256dh: subscription.p256dh,
                            auth: subscription.auth,
                        },
                    },
                    payload
                )

                sent += 1

                console.log('push success', {
                    subscriptionId: subscription.id,
                    userId: subscription.user_id,
                    endpoint: maskEndpoint(subscription.endpoint),
                    isApple: subscription.endpoint.startsWith('https://web.push.apple.com/'),
                })
            } catch (error) {
                failed += 1

                console.error('push failed', {
                    subscriptionId: subscription.id,
                    userId: subscription.user_id,
                    endpoint: maskEndpoint(subscription.endpoint),
                    isApple: subscription.endpoint.startsWith('https://web.push.apple.com/'),
                    error: getPushErrorInfo(error),
                })

                if (isExpiredSubscriptionError(error)) {
                    expiredSubscriptionIds.push(subscription.id)
                }
            }
        }))

        if (expiredSubscriptionIds.length > 0) {
            const { error: deleteError } = await supabase
                .from('push_subscriptions')
                .delete()
                .in('id', expiredSubscriptionIds)

            if (deleteError) {
                console.error('expired subscription delete failed', {
                    expiredSubscriptionIds,
                    deleteError,
                })
            }
        }

        const result = {
            ok: true,
            sent,
            failed,
            expired: expiredSubscriptionIds.length,
        }

        console.log('notification result', result)

        return Response.json(result)
    } catch (error) {
        console.error('notification_failed', getPushErrorInfo(error))

        return Response.json({ error: 'notification_failed' }, { status: 500 })
    }
}