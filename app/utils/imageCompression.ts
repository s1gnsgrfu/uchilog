export type DiaryImageFiles = {
    thumb: File
    display: File
}

const THUMB_WIDTH = 400
const THUMB_QUALITY = 0.75
const DISPLAY_WIDTH = 1600
const DISPLAY_QUALITY = 0.8

const isHeicImage = (file: File) => {
    return file.type === 'image/heic'
        || file.type === 'image/heif'
        || /\.(heic|heif)$/i.test(file.name)
}

const normalizeImageFile = async (file: File) => {
    if (!isHeicImage(file)) {
        return file
    }

    try {
        const { default: heic2any } = await import('heic2any')
        const converted = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.92,
        })
        const convertedBlob = Array.isArray(converted) ? converted[0] : converted
        const convertedName = file.name.replace(/\.(heic|heif)$/i, '.jpg')

        return new File([convertedBlob], convertedName, { type: 'image/jpeg' })
    } catch {
        return file
    }
}

const loadImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(image)
    }
    image.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('画像を読み込めませんでした'))
    }
    image.src = objectUrl
})

const resizeToWebp = async (
    source: HTMLImageElement,
    maxWidth: number,
    quality: number,
    fileName: string
) => {
    const ratio = Math.min(1, maxWidth / source.naturalWidth)
    const width = Math.max(1, Math.round(source.naturalWidth * ratio))
    const height = Math.max(1, Math.round(source.naturalHeight * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
        throw new Error('画像を変換できませんでした')
    }

    context.drawImage(source, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/webp', quality)
    })

    if (!blob) {
        throw new Error('WebP画像を作成できませんでした')
    }

    canvas.width = 0
    canvas.height = 0

    return new File([blob], fileName, { type: 'image/webp' })
}

export const compressDiaryImage = async (file: File): Promise<DiaryImageFiles> => {
    const imageFile = await normalizeImageFile(file)
    const source = await loadImage(imageFile)

    const thumb = await resizeToWebp(source, THUMB_WIDTH, THUMB_QUALITY, 'thumb.webp')
    const display = await resizeToWebp(source, DISPLAY_WIDTH, DISPLAY_QUALITY, 'display.webp')

    return { thumb, display }
}
