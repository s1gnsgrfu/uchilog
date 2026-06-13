'use client'

import { useState } from 'react'
import { convertHeicToWebp } from './convertHeicToWebp'

export function HeicWebpUploadExample() {
    const [isUploading, setIsUploading] = useState(false)
    const [message, setMessage] = useState('')

    const uploadImage = async (file: File) => {
        setIsUploading(true)
        setMessage('')

        try {
            const convertedFile = await convertHeicToWebp(file)
            const formData = new FormData()
            formData.append('image', convertedFile)

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                throw new Error('upload_failed')
            }

            setMessage('アップロードしました')
        } catch {
            setMessage('画像の変換に失敗しました')
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div className="space-y-3">
            <label className="inline-flex cursor-pointer rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">
                {isUploading ? '変換中...' : '画像を選択'}
                <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    disabled={isUploading}
                    onChange={(event) => {
                        const file = event.target.files?.[0] ?? null
                        event.target.value = ''

                        if (file) {
                            void uploadImage(file)
                        }
                    }}
                    className="sr-only"
                />
            </label>
            {message && <p className="text-sm text-zinc-600">{message}</p>}
        </div>
    )
}
