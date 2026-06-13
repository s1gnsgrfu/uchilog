import { convertHeicToWebp, isHeicOrHeifImage } from '@/src/lib/image/convertHeicToWebp'

export type DiaryImageFiles = {
    thumb: File
    display: File
}

const THUMB_WIDTH = 400
const THUMB_QUALITY = 0.75
const DISPLAY_WIDTH = 1600
const DISPLAY_QUALITY = 0.8

type LoadedImage = {
    source: CanvasImageSource
    width: number
    height: number
    close?: () => void
}

const loadImageElement = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
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

const loadResizedImageBitmap = async (file: File, width: number, height: number): Promise<LoadedImage> => {
    if (typeof createImageBitmap !== 'function') {
        throw new Error('createImageBitmap is not supported')
    }

    const imageBitmap = await createImageBitmap(file, {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: 'high',
        imageOrientation: 'from-image',
    })

    return {
        source: imageBitmap,
        width: imageBitmap.width,
        height: imageBitmap.height,
        close: () => imageBitmap.close(),
    }
}

const loadImageForResize = async (file: File, maxWidth: number): Promise<LoadedImage> => {
    const image = await loadImageElement(file)
    const ratio = Math.min(1, maxWidth / image.naturalWidth)
    const width = Math.max(1, Math.round(image.naturalWidth * ratio))
    const height = Math.max(1, Math.round(image.naturalHeight * ratio))

    try {
        return await loadResizedImageBitmap(file, width, height)
    } catch {
        return {
            source: image,
            width,
            height,
        }
    }
}

const resizeToWebp = async (
    image: LoadedImage,
    maxWidth: number,
    quality: number,
    fileName: string
) => {
    const ratio = Math.min(1, maxWidth / image.width)
    const width = Math.max(1, Math.round(image.width * ratio))
    const height = Math.max(1, Math.round(image.height * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
        throw new Error('画像を変換できませんでした')
    }

    context.drawImage(image.source, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/webp', quality)
    })

    if (!blob) {
        throw new Error('WebP画像を作成できませんでした')
    }

    image.close?.()
    canvas.width = 0
    canvas.height = 0

    return new File([blob], fileName, { type: 'image/webp' })
}

export const compressDiaryImage = async (file: File): Promise<DiaryImageFiles> => {
    const imageFile = await convertHeicToWebp(file)
    let displaySource: LoadedImage

    try {
        displaySource = await loadImageForResize(imageFile, DISPLAY_WIDTH)
    } catch {
        if (isHeicOrHeifImage(file)) {
            throw new Error('HEIC/HEIF画像を読み込めませんでした。写真をJPEGまたはPNGに変換してから選択してください。')
        }

        throw new Error('画像を読み込めませんでした。別の画像を選択してください。')
    }

    const display = await resizeToWebp(displaySource, DISPLAY_WIDTH, DISPLAY_QUALITY, 'display.webp')
    const thumbSource = await loadImageForResize(display, THUMB_WIDTH)
    const thumb = await resizeToWebp(thumbSource, THUMB_WIDTH, THUMB_QUALITY, 'thumb.webp')

    return { thumb, display }
}
