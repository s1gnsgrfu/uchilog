import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export type ReminderWorkerEnv = {
    NEXT_PUBLIC_SUPABASE_URL?: string
    SUPABASE_SERVICE_ROLE_KEY?: string
    NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string
    VAPID_PRIVATE_KEY?: string
    VAPID_CONTACT_EMAIL?: string
}

type ReminderSettingRow = {
    user_id: string
    reminder_time: string
    timezone: string
    last_processed_on: string | null
}

type DiaryRow = {
    created_at: string
}

type PushSubscriptionRow = {
    id: string
    endpoint: string
    p256dh: string
    auth: string
}

type ZonedDateTime = {
    date: string
    minutes: number
}

const DIARY_LOOKBACK_MS = 36 * 60 * 60 * 1000

function getRequiredEnv(env: ReminderWorkerEnv) {
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
    const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = env.VAPID_PRIVATE_KEY

    if (!supabaseUrl || !serviceRoleKey || !publicKey || !privateKey) {
        throw new Error('Reminder notification env vars are not configured')
    }

    return {
        supabaseUrl,
        serviceRoleKey,
        publicKey,
        privateKey,
    }
}

function getZonedDateTime(date: Date, timezone: string): ZonedDateTime | null {
    try {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(date)
        const partMap = new Map(parts.map((part) => [part.type, part.value]))
        const year = partMap.get('year')
        const month = partMap.get('month')
        const day = partMap.get('day')
        const hour = Number(partMap.get('hour'))
        const minute = Number(partMap.get('minute'))

        if (!year || !month || !day || !Number.isInteger(hour) || !Number.isInteger(minute)) {
            return null
        }

        return {
            date: `${year}-${month}-${day}`,
            minutes: hour * 60 + minute,
        }
    } catch {
        return null
    }
}

function getReminderMinutes(reminderTime: string) {
    const match = reminderTime.match(/^(\d{2}):(\d{2})/)

    if (!match) {
        return null
    }

    const hour = Number(match[1])
    const minute = Number(match[2])

    if (hour > 23 || minute > 59) {
        return null
    }

    return hour * 60 + minute
}

function isExpiredSubscriptionError(error: unknown) {
    return typeof error === 'object'
        && error !== null
        && 'statusCode' in error
        && (error.statusCode === 404 || error.statusCode === 410)
}

export async function sendDueDiaryReminders(env: ReminderWorkerEnv, scheduledAt: Date) {
    const requiredEnv = getRequiredEnv(env)
    const supabase = createClient(requiredEnv.supabaseUrl, requiredEnv.serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    })

    webpush.setVapidDetails(
        `mailto:${env.VAPID_CONTACT_EMAIL ?? 'noreply@uchilog.local'}`,
        requiredEnv.publicKey,
        requiredEnv.privateKey
    )

    const { data: settings, error: settingsError } = await supabase
        .from('diary_reminder_settings')
        .select('user_id,reminder_time,timezone,last_processed_on')
        .eq('enabled', true)
        .returns<ReminderSettingRow[]>()

    if (settingsError) {
        throw settingsError
    }

    await Promise.all((settings ?? []).map(async (setting) => {
        const localNow = getZonedDateTime(scheduledAt, setting.timezone)
        const reminderMinutes = getReminderMinutes(setting.reminder_time)

        if (
            !localNow
            || reminderMinutes === null
            || localNow.minutes < reminderMinutes
            || setting.last_processed_on === localNow.date
        ) {
            return
        }

        const recentSince = new Date(scheduledAt.getTime() - DIARY_LOOKBACK_MS).toISOString()
        const { data: recentDiaries, error: diariesError } = await supabase
            .from('diaries')
            .select('created_at')
            .eq('user_id', setting.user_id)
            .gte('created_at', recentSince)
            .order('created_at', { ascending: false })
            .limit(50)
            .returns<DiaryRow[]>()

        if (diariesError) {
            throw diariesError
        }

        const hasDiaryToday = (recentDiaries ?? []).some((diary) => (
            getZonedDateTime(new Date(diary.created_at), setting.timezone)?.date === localNow.date
        ))

        if (!hasDiaryToday) {
            const { data: subscriptions, error: subscriptionsError } = await supabase
                .from('push_subscriptions')
                .select('id,endpoint,p256dh,auth')
                .eq('user_id', setting.user_id)
                .returns<PushSubscriptionRow[]>()

            if (subscriptionsError) {
                throw subscriptionsError
            }

            const payload = JSON.stringify({
                title: 'UchiLog',
                body: '今日のこと、日記に残しておきませんか？',
                url: '/write',
            })
            const expiredSubscriptionIds: string[] = []

            await Promise.all((subscriptions ?? []).map(async (subscription) => {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: subscription.endpoint,
                            keys: {
                                p256dh: subscription.p256dh,
                                auth: subscription.auth,
                            },
                        },
                        payload
                    )
                } catch (error) {
                    if (isExpiredSubscriptionError(error)) {
                        expiredSubscriptionIds.push(subscription.id)
                    }
                }
            }))

            if (expiredSubscriptionIds.length > 0) {
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .in('id', expiredSubscriptionIds)
            }
        }

        await supabase
            .from('diary_reminder_settings')
            .update({
                last_processed_on: localNow.date,
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', setting.user_id)
    }))
}
