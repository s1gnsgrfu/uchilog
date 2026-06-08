export const DISCORD_LOGIN_SCOPES = 'identify email guilds'

export const authErrorMessages: Record<string, string> = {
    callback_failed: 'ログイン処理に失敗しました。もう一度試してください。',
    discord_guild_required: '特定のDiscordサーバーに参加している人だけが利用できます',
    discord_scope_missing: 'Discordサーバー確認に必要な権限を取得できませんでした。もう一度ログインしてください。',
}
