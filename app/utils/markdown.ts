export const getFirstMarkdownImage = (body: string) => {
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
