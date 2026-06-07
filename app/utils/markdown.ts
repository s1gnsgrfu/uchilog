export const getFirstMarkdownImage = (body: string, imageOwnerId?: string) => {
    const legacyDiaryImageMatch = body.match(/\[\[画像:(.*?):([0-9a-f-]{36})]]/)

    if (legacyDiaryImageMatch && imageOwnerId) {
        return {
            alt: legacyDiaryImageMatch[1] || '日記画像',
            src: `/api/images/diaries/${imageOwnerId}/${legacyDiaryImageMatch[2]}/display.webp`,
        }
    }

    const diaryImageMatch = body.match(/\[\[画像:([^\]\n]+)]]/)

    if (diaryImageMatch && imageOwnerId) {
        return {
            alt: diaryImageMatch[1].replace(/\.webp$/i, '') || '日記画像',
            src: `/api/images/diaries/${imageOwnerId}/${encodeURIComponent(diaryImageMatch[1])}/display.webp`,
        }
    }

    const imageMatch = body.match(/!\[(.*?)]\(((?:https?:\/\/|\/)[^)]+)\)/)

    if (!imageMatch) {
        return null
    }

    return {
        alt: imageMatch[1] || '日記画像',
        src: imageMatch[2],
    }
}

export const getTimelineThumbnailUrl = (src: string) => {
    if (src.startsWith('/api/images/') && src.endsWith('/display.webp')) {
        return src.replace(/\/display\.webp$/, '/thumb.webp')
    }

    return src
}
