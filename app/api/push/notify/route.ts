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
            return Response.json({ error: 'diary_not_found' }, { status: 404 })
        }

        if (!diary.is_shared) {
            return Response.json({ ok: true, sent: 0 })
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
            return Response.json({ error: 'subscriptions_fetch_failed' }, { status: 500 })
        }

        if (!subscriptions || subscriptions.length === 0) {
            return Response.json({ ok: true, sent: 0 })
        }

        configureWebPush()

        const payload = JSON.stringify({
            title: 'UchiLog',
            body: `${authorName}さんが日記を投稿しました！`,
            url: `/diary/${diary.id}`,
        })

        let sent = 0
        const expiredSubscriptionIds: string[] = []

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
            } catch (error) {
                if (isExpiredSubscriptionError(error)) {
                    expiredSubscriptionIds.push(subscription.id)
                }
            }
        }))

        if (expiredSubscriptionIds.length > 0) {
            await supabase
                .from('push_subscriptions')
                .delete()
                .in('id', expiredSubscriptionIds)
        }

        return Response.json({ ok: true, sent })
    } catch {
        return Response.json({ error: 'notification_failed' }, { status: 500 })
    }
}
