export const isHeicOrHeifImage = (file: File) => {
    return file.type === 'image/heic'
        || file.type === 'image/heif'
        || /\.(heic|heif)$/i.test(file.name)
}

const replaceImageExtension = (fileName: string, nextExtension: string) => {
    if (/\.[a-z0-9]+$/i.test(fileName)) {
        return fileName.replace(/\.[a-z0-9]+$/i, nextExtension)
    }

    return `${fileName}${nextExtension}`
}

const blobToImageBitmap = async (blob: Blob) => {
    try {
        return await createImageBitmap(blob)
    } catch {
        throw new Error('画像の変換に失敗しました')
    }
}

const canvasToWebpBlob = async (canvas: HTMLCanvasElement) => {
    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/webp', 0.85)
    })

    if (!blob) {
        throw new Error('画像の変換に失敗しました')
    }

    return blob
}

export const convertHeicToWebp = async (file: File) => {
    if (!isHeicOrHeifImage(file)) {
        return file
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
        throw new Error('画像の変換に失敗しました')
    }

    try {
        const { default: heic2any } = await import('heic2any')
        const jpegResult = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.92,
        })
        const jpegBlob = Array.isArray(jpegResult) ? jpegResult[0] : jpegResult
        const imageBitmap = await blobToImageBitmap(jpegBlob)
        const canvas = document.createElement('canvas')
        canvas.width = imageBitmap.width
        canvas.height = imageBitmap.height

        const context = canvas.getContext('2d')

        if (!context) {
            imageBitmap.close()
            throw new Error('画像の変換に失敗しました')
        }

        context.drawImage(imageBitmap, 0, 0)
        imageBitmap.close()

        const webpBlob = await canvasToWebpBlob(canvas)
        canvas.width = 0
        canvas.height = 0

        return new File(
            [webpBlob],
            replaceImageExtension(file.name, '.webp'),
            { type: 'image/webp' }
        )
    } catch {
        throw new Error('画像の変換に失敗しました')
    }
}
