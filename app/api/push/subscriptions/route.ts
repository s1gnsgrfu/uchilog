import { createAdminClient, getAuthenticatedUserId } from '../_supabase'

type PushSubscriptionBody = {
    subscription?: {
        endpoint?: unknown
        keys?: {
            p256dh?: unknown
            auth?: unknown
        }
    }
}

function parseSubscription(body: PushSubscriptionBody) {
    const subscription = body.subscription

    if (
        !subscription
        || typeof subscription.endpoint !== 'string'
        || typeof subscription.keys?.p256dh !== 'string'
        || typeof subscription.keys.auth !== 'string'
    ) {
        return null
    }

    return {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getAuthenticatedUserId(request)

        if (!userId) {
            return Response.json({ error: 'unauthorized' }, { status: 401 })
        }

        const body = await request.json() as PushSubscriptionBody
        const subscription = parseSubscription(body)

        if (!subscription) {
            return Response.json({ error: 'invalid_subscription' }, { status: 400 })
        }

        const supabase = createAdminClient()
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: userId,
                endpoint: subscription.endpoint,
                p256dh: subscription.p256dh,
                auth: subscription.auth,
                user_agent: request.headers.get('user-agent'),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'endpoint',
            })

        if (error) {
            return Response.json({ error: 'subscription_save_failed' }, { status: 500 })
        }

        return Response.json({ ok: true })
    } catch {
        return Response.json({ error: 'subscription_save_failed' }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const userId = await getAuthenticatedUserId(request)

        if (!userId) {
            return Response.json({ error: 'unauthorized' }, { status: 401 })
        }

        const body = await request.json() as { endpoint?: unknown }
        const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''

        if (!endpoint) {
            return Response.json({ error: 'invalid_endpoint' }, { status: 400 })
        }

        const supabase = createAdminClient()
        const { error } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('endpoint', endpoint)

        if (error) {
            return Response.json({ error: 'subscription_delete_failed' }, { status: 500 })
        }

        return Response.json({ ok: true })
    } catch {
        return Response.json({ error: 'subscription_delete_failed' }, { status: 500 })
    }
}
