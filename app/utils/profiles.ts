import { supabase } from '@/lib/supabase'
import type { Profile } from './types'
import type { User } from '@supabase/supabase-js'

export const profileFromUserMetadata = (user: User) => {
    const metadata = user.user_metadata as {
        avatar_url?: string
        full_name?: string
        name?: string
        picture?: string
    }

    return {
        id: user.id,
        display_name: metadata.full_name ?? metadata.name ?? user.email ?? '名無し',
        avatar_url: metadata.avatar_url ?? metadata.picture ?? null,
    }
}

export const syncProfile = async (user: User): Promise<Profile | null> => {
    const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

    if (fetchError) {
        throw fetchError
    }

    if (existingProfile) {
        return existingProfile
    }

    const { data: createdProfile, error: upsertError } = await supabase
        .from('profiles')
        .upsert(profileFromUserMetadata(user), {
            ignoreDuplicates: true,
            onConflict: 'id',
        })
        .select()
        .maybeSingle()

    if (upsertError) {
        throw upsertError
    }

    if (createdProfile) {
        return createdProfile
    }

    const { data: duplicateProfile, error: duplicateFetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

    if (duplicateFetchError) {
        throw duplicateFetchError
    }

    return duplicateProfile
}

export const fetchProfilesByIds = async (userIds: string[]) => {
    const uniqueIds = [...new Set(userIds)]

    if (uniqueIds.length === 0) {
        return new Map<string, Profile>()
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', uniqueIds)

    if (error) {
        throw error
    }

    return new Map((data ?? []).map((profile) => [profile.id, profile]))
}
