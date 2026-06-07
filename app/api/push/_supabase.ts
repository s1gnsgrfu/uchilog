import { createClient } from '@supabase/supabase-js'

export type PushSubscriptionRow = {
    id: string
    user_id: string
    endpoint: string
    p256dh: string
    auth: string
}

export function getAccessToken(request: Request) {
    const authorization = request.headers.get('authorization')
    const match = authorization?.match(/^Bearer\s+(.+)$/i)
    return match?.[1] ?? null
}

export function createAuthClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase public env vars are not configured')
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    })
}

export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Supabase admin env vars are not configured')
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    })
}

export async function getAuthenticatedUserId(request: Request) {
    const accessToken = getAccessToken(request)

    if (!accessToken) {
        return null
    }

    const supabase = createAuthClient()
    const { data, error } = await supabase.auth.getUser(accessToken)

    if (error || !data.user) {
        return null
    }

    return data.user.id
}
