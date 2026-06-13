export type Profile = {
    id: string
    display_name: string | null
    avatar_url: string | null
    bio: string | null
    created_at: string
    updated_at: string
}

export type Diary = {
    id: string
    user_id: string
    title: string
    body: string
    is_shared: boolean
    created_at: string
    updated_at: string
}

export type DiaryWithAuthor = Diary & {
    author: Profile | null
}

export type DiaryReaction = {
    diary_id: string
    user_id: string
    reaction: string
    created_at: string
}

export type DiaryReactionSummary = {
    count: number
    reactedByCurrentUser: boolean
}

export type DiaryComment = {
    id: string
    diary_id: string
    user_id: string
    body: string
    created_at: string
    updated_at: string
}

export type DiaryCommentWithAuthor = DiaryComment & {
    author: Profile | null
}
