import Image from 'next/image'
import type { ReactNode } from 'react'

const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)

    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index}>{part.slice(2, -2)}</strong>
        }

        return <span key={index}>{part}</span>
    })
}

const getDiaryImageUrl = (ownerId: string, imageId: string, variant: 'thumb' | 'display') => {
    return `/api/images/diaries/${ownerId}/${imageId}/${variant}.webp`
}

export function MarkdownRenderer({ body, imageOwnerId }: { body: string; imageOwnerId?: string }) {
    const lines = body.split('\n')
    const elements: ReactNode[] = []
    let codeLines: string[] = []
    let listItems: string[] = []
    let inCode = false

    const flushList = () => {
        if (listItems.length === 0) {
            return
        }

        elements.push(
            <ul key={`list-${elements.length}`} className="my-4 list-disc space-y-1 pl-6">
                {listItems.map((item, index) => (
                    <li key={index}>{renderInline(item)}</li>
                ))}
            </ul>
        )
        listItems = []
    }

    const flushCode = () => {
        elements.push(
            <pre
                key={`code-${elements.length}`}
                className="my-5 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm text-zinc-50"
            >
                <code>{codeLines.join('\n')}</code>
            </pre>
        )
        codeLines = []
    }

    lines.forEach((line, index) => {
        if (line.trim().startsWith('```')) {
            if (inCode) {
                flushCode()
                inCode = false
            } else {
                flushList()
                inCode = true
            }
            return
        }

        if (inCode) {
            codeLines.push(line)
            return
        }

        const diaryImageMatch = line.match(/^\[\[画像:(.*?):([0-9a-f-]{36})]]$/)
        if (diaryImageMatch && imageOwnerId) {
            flushList()
            elements.push(
                <Image
                    key={index}
                    src={getDiaryImageUrl(imageOwnerId, diaryImageMatch[2], 'display')}
                    alt={diaryImageMatch[1] || '日記画像'}
                    width={960}
                    height={540}
                    unoptimized
                    className="my-6 max-h-[520px] w-full rounded-xl object-cover"
                />
            )
            return
        }

        const imageMatch = line.match(/^!\[(.*)]\(((?:https?:\/\/|\/)[^)]+)\)$/)
        if (imageMatch) {
            flushList()
            elements.push(
                <Image
                    key={index}
                    src={imageMatch[2]}
                    alt={imageMatch[1]}
                    width={960}
                    height={540}
                    unoptimized
                    className="my-6 max-h-[520px] w-full rounded-xl object-cover"
                />
            )
            return
        }

        if (line.startsWith('### ')) {
            flushList()
            elements.push(<h3 key={index} className="mt-8 text-xl font-bold">{renderInline(line.slice(4))}</h3>)
            return
        }

        if (line.startsWith('## ')) {
            flushList()
            elements.push(<h2 key={index} className="mt-10 text-2xl font-bold">{renderInline(line.slice(3))}</h2>)
            return
        }

        if (line.startsWith('# ')) {
            flushList()
            elements.push(<h1 key={index} className="mt-10 text-3xl font-bold">{renderInline(line.slice(2))}</h1>)
            return
        }

        if (line.startsWith('> ')) {
            flushList()
            elements.push(
                <blockquote key={index} className="my-5 border-l-4 border-zinc-300 pl-4 text-zinc-600">
                    {renderInline(line.slice(2))}
                </blockquote>
            )
            return
        }

        if (line.startsWith('- ')) {
            listItems.push(line.slice(2))
            return
        }

        flushList()

        if (!line.trim()) {
            elements.push(<div key={index} className="h-4" />)
            return
        }

        elements.push(
            <p key={index} className="leading-8 text-zinc-800">
                {renderInline(line)}
            </p>
        )
    })

    flushList()

    if (inCode) {
        flushCode()
    }

    return <div className="space-y-1">{elements}</div>
}
