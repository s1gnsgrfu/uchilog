type LogoutConfirmDialogProps = {
    onCancel: () => void
    onConfirm: () => void
}

export function LogoutConfirmDialog({ onCancel, onConfirm }: LogoutConfirmDialogProps) {
    return (
        <div
            onClick={onCancel}
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6"
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="logout-confirm-title"
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            >
                <h2 id="logout-confirm-title" className="text-lg font-bold text-zinc-950">
                    ログアウトしますか？
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                    もう一度Discordログインするまで、日記の投稿やタイムライン表示はできません。
                </p>
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-400 hover:text-zinc-950"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={onConfirm}
                        className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                    >
                        ログアウト
                    </button>
                </div>
            </section>
        </div>
    )
}
