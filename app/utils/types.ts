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
    created_at: string
    updated_at: string
}

export type DiaryWithAuthor = Diary & {
    author: Profile | null
}
