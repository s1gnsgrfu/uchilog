import { ALLOWED_DISCORD_GUILD_ID } from '../../../utils/auth'

type DiscordGuild = {
    id?: string
}

export async function POST(request: Request) {
    try {
        const body = await request.json() as { providerToken?: unknown }
        const providerToken = body.providerToken

        if (typeof providerToken !== 'string' || !providerToken.trim()) {
            return Response.json(
                { allowed: false, error: 'missing_provider_token' },
                { status: 400 }
            )
        }

        const discordResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${providerToken}`,
            },
            cache: 'no-store',
        })

        if (!discordResponse.ok) {
            return Response.json(
                { allowed: false, error: 'discord_request_failed' },
                { status: discordResponse.status === 401 ? 401 : 502 }
            )
        }

        const guilds = await discordResponse.json() as DiscordGuild[]
        const allowed = Array.isArray(guilds) && guilds.some((guild) => guild.id === ALLOWED_DISCORD_GUILD_ID)

        return Response.json({ allowed })
    } catch {
        return Response.json(
            { allowed: false, error: 'discord_guild_check_failed' },
            { status: 500 }
        )
    }
}
