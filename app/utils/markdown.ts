export const getFirstMarkdownImage = (body: string, imageOwnerId?: string) => {
    const diaryImageMatch = body.match(/\[\[画像:(.*?):([0-9a-f-]{36})]]/)

    if (diaryImageMatch && imageOwnerId) {
        return {
            alt: diaryImageMatch[1] || '日記画像',
            src: `/api/images/diaries/${imageOwnerId}/${diaryImageMatch[2]}/display.webp`,
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
