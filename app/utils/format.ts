export const formatDateLabel = (value: string) => {
    const date = new Date(value)
    return new Intl.DateTimeFormat('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
    }).format(date)
}

export const formatDateTime = (value: string) => {
    const date = new Date(value)
    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

export const getDateKey = (value: string) => {
    const date = new Date(value)
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}
