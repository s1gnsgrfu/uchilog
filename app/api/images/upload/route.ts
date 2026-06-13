import { createClient } from '@supabase/supabase-js'
import { getDiaryImagesBucket, getImagesBinding } from '../_r2'

const MAX_THUMB_SIZE = 512 * 1024
const MAX_DISPLAY_SIZE = 3 * 1024 * 1024
const MAX_ORIGINAL_SIZE = 15 * 1024 * 1024
const THUMB_WIDTH = 400
const THUMB_QUALITY = 75
const DISPLAY_WIDTH = 1600
const DISPLAY_QUALITY = 80
const SUPPORTED_SERVER_IMAGE_TYPES = new Set([
    'image/avif',
    'image/jpeg',
    'image/png',
    'image/webp',
])
const SUPPORTED_SERVER_IMAGE_EXTENSIONS = /\.(avif|jpe?g|png|webp)$/i

type UploadResult = {
    imageName: string
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

function isValidOriginalImageFile(value: FormDataEntryValue | null): value is File {
    return value instanceof File
        && (
            SUPPORTED_SERVER_IMAGE_TYPES.has(value.type)
            || SUPPORTED_SERVER_IMAGE_EXTENSIONS.test(value.name)
        )
        && value.size > 0
        && value.size <= MAX_ORIGINAL_SIZE
}

async function transformToWebp(file: File, width: number, quality: number) {
    const images = await getImagesBinding()
    const result = await images
        .input(file.stream())
        .transform({
            width,
            fit: 'scale-down',
        })
        .output({
            format: 'image/webp',
            quality,
        })

    return await new Response(result.image()).arrayBuffer()
}

async function getUploadImageBuffers(formData: FormData) {
    const thumb = formData.get('thumb')
    const display = formData.get('display')

    if (isValidWebpFile(thumb, MAX_THUMB_SIZE) && isValidWebpFile(display, MAX_DISPLAY_SIZE)) {
        return {
            thumbBuffer: await thumb.arrayBuffer(),
            displayBuffer: await display.arrayBuffer(),
        }
    }

    const image = formData.get('image')

    if (!isValidOriginalImageFile(image)) {
        return null
    }

    const [thumbBuffer, displayBuffer] = await Promise.all([
        transformToWebp(image, THUMB_WIDTH, THUMB_QUALITY),
        transformToWebp(image, DISPLAY_WIDTH, DISPLAY_QUALITY),
    ])

    if (thumbBuffer.byteLength > MAX_THUMB_SIZE || displayBuffer.byteLength > MAX_DISPLAY_SIZE) {
        return null
    }

    return {
        thumbBuffer,
        displayBuffer,
    }
}

function getSafeImageBaseName(originalName: string) {
    const fileName = originalName.split(/[/\\]/).pop() ?? ''
    const baseName = fileName.replace(/\.[^.]+$/, '')
    const safeBaseName = baseName
        .normalize('NFC')
        .replace(/[\\/:*?"<>|#%[\]\u0000-\u001f]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80)

    return safeBaseName || 'image'
}

async function createUniqueImageName(
    bucket: Awaited<ReturnType<typeof getDiaryImagesBucket>>,
    userId: string,
    originalName: string
) {
    const baseName = getSafeImageBaseName(originalName)

    for (let index = 0; index < 50; index += 1) {
        const suffix = index === 0 ? '' : `-${index + 1}`
        const imageName = `${baseName}${suffix}.webp`
        const displayKey = `diaries/${userId}/${imageName}/display.webp`
        const existingObject = await bucket.get(displayKey)

        if (!existingObject) {
            return imageName
        }
    }

    return `${baseName}-${crypto.randomUUID().slice(0, 8)}.webp`
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
        const originalNameValue = formData.get('originalName')
        const originalName = typeof originalNameValue === 'string' ? originalNameValue.slice(0, 120) : ''
        const imageBuffers = await getUploadImageBuffers(formData)

        if (!imageBuffers) {
            return Response.json(
                { error: 'invalid_image' },
                { status: 400 }
            )
        }

        const bucket = await getDiaryImagesBucket()
        const imageName = await createUniqueImageName(bucket, userId, originalName)
        const encodedImageName = encodeURIComponent(imageName)
        const keyPrefix = `diaries/${userId}/${imageName}`
        const thumbKey = `${keyPrefix}/thumb.webp`
        const displayKey = `${keyPrefix}/display.webp`
        const cacheControl = 'public, max-age=31536000, immutable'

        await Promise.all([
            bucket.put(thumbKey, imageBuffers.thumbBuffer, {
                httpMetadata: {
                    contentType: 'image/webp',
                    cacheControl,
                },
                customMetadata: {
                    userId,
                    imageName,
                    originalName,
                    variant: 'thumb',
                },
            }),
            bucket.put(displayKey, imageBuffers.displayBuffer, {
                httpMetadata: {
                    contentType: 'image/webp',
                    cacheControl,
                },
                customMetadata: {
                    userId,
                    imageName,
                    originalName,
                    variant: 'display',
                },
            }),
        ])

        const result: UploadResult = {
            imageName,
            thumbUrl: `/api/images/diaries/${userId}/${encodedImageName}/thumb.webp`,
            displayUrl: `/api/images/diaries/${userId}/${encodedImageName}/display.webp`,
        }

        return Response.json(result)
    } catch {
        return Response.json(
            { error: 'image_upload_failed' },
            { status: 500 }
        )
    }
}
