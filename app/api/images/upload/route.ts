import { createClient } from '@supabase/supabase-js'
import { getDiaryImagesBucket } from '../_r2'

const MAX_THUMB_SIZE = 512 * 1024
const MAX_DISPLAY_SIZE = 3 * 1024 * 1024

type UploadResult = {
    thumbUrl: string
    displayUrl: string
}

function getAccessToken(request: Request) {
    const authorization = request.headers.get('authorization')
    const match = authorization?.match(/^Bearer\s+(.+)$/i)
    return match?.[1] ?? null
}

async function getAuthenticatedUserId(request: Request) {
    const accessToken = getAccessToken(request)

    if (!accessToken) {
        return null
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase env vars are not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    })
    const { data, error } = await supabase.auth.getUser(accessToken)

    if (error || !data.user) {
        return null
    }

    return data.user.id
}

function isValidWebpFile(value: FormDataEntryValue | null, maxSize: number): value is File {
    return value instanceof File
        && value.type === 'image/webp'
        && value.size > 0
        && value.size <= maxSize
}

export async function POST(request: Request) {
    try {
        const userId = await getAuthenticatedUserId(request)

        if (!userId) {
            return Response.json(
                { error: 'unauthorized' },
                { status: 401 }
            )
        }

        const formData = await request.formData()
        const thumb = formData.get('thumb')
        const display = formData.get('display')
        const originalNameValue = formData.get('originalName')
        const originalName = typeof originalNameValue === 'string' ? originalNameValue.slice(0, 120) : ''

        if (!isValidWebpFile(thumb, MAX_THUMB_SIZE) || !isValidWebpFile(display, MAX_DISPLAY_SIZE)) {
            return Response.json(
                { error: 'invalid_image' },
                { status: 400 }
            )
        }

        const bucket = await getDiaryImagesBucket()
        const imageId = crypto.randomUUID()
        const keyPrefix = `diaries/${userId}/${imageId}`
        const thumbKey = `${keyPrefix}/thumb.webp`
        const displayKey = `${keyPrefix}/display.webp`
        const cacheControl = 'public, max-age=31536000, immutable'

        await Promise.all([
            bucket.put(thumbKey, await thumb.arrayBuffer(), {
                httpMetadata: {
                    contentType: 'image/webp',
                    cacheControl,
                },
                customMetadata: {
                    userId,
                    originalName,
                    variant: 'thumb',
                },
            }),
            bucket.put(displayKey, await display.arrayBuffer(), {
                httpMetadata: {
                    contentType: 'image/webp',
                    cacheControl,
                },
                customMetadata: {
                    userId,
                    originalName,
                    variant: 'display',
                },
            }),
        ])

        const result: UploadResult = {
            thumbUrl: `/api/images/${thumbKey}`,
            displayUrl: `/api/images/${displayKey}`,
        }

        return Response.json(result)
    } catch {
        return Response.json(
            { error: 'image_upload_failed' },
            { status: 500 }
        )
    }
}
