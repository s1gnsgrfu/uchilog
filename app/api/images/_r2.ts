import { getCloudflareContext } from '@opennextjs/cloudflare'

type R2PutOptions = {
    httpMetadata?: {
        contentType?: string
        cacheControl?: string
    }
    customMetadata?: Record<string, string>
}

export type R2ObjectBodyLike = {
    body: ReadableStream
    httpEtag?: string
    httpMetadata?: {
        contentType?: string
        cacheControl?: string
    }
}

export type R2BucketLike = {
    put: (
        key: string,
        value: ArrayBuffer,
        options?: R2PutOptions
    ) => Promise<unknown>
    get: (key: string) => Promise<R2ObjectBodyLike | null>
}

type CloudflareContext = {
    env: {
        DIARY_IMAGES?: R2BucketLike
    }
}

export async function getDiaryImagesBucket() {
    const { env } = await getCloudflareContext({ async: true }) as CloudflareContext

    if (!env.DIARY_IMAGES) {
        throw new Error('DIARY_IMAGES binding is not configured')
    }

    return env.DIARY_IMAGES
}

export function imageResponseHeaders(object: R2ObjectBodyLike) {
    const headers = new Headers()
    headers.set('Content-Type', object.httpMetadata?.contentType ?? 'image/webp')
    headers.set('Cache-Control', object.httpMetadata?.cacheControl ?? 'public, max-age=31536000, immutable')

    if (object.httpEtag) {
        headers.set('ETag', object.httpEtag)
    }

    return headers
}
