import { getDiaryImagesBucket, imageResponseHeaders } from '../_r2'

export async function GET(
    _request: Request,
    context: { params: Promise<{ key: string[] }> }
) {
    try {
        const { key } = await context.params
        const objectKey = key.join('/')

        if (!objectKey || objectKey.includes('..')) {
            return new Response('Not found', { status: 404 })
        }

        const bucket = await getDiaryImagesBucket()
        const object = await bucket.get(objectKey)

        if (!object) {
            return new Response('Not found', { status: 404 })
        }

        return new Response(object.body, {
            headers: imageResponseHeaders(object),
        })
    } catch {
        return new Response('Image request failed', { status: 500 })
    }
}
