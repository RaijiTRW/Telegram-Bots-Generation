'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { CustomImage } from './extensions/image-upload'
import { CustomVideo } from './extensions/video-upload'
import Link from '@tiptap/extension-link'
import Youtube from '@tiptap/extension-youtube'
import {
    Bold,
    Italic,
    Strikethrough,
    Code,
    List,
    ListOrdered,
    Quote,
    Heading1,
    Heading2,
    Heading3,
    Undo,
    Redo,
    ImageIcon,
    Video,
    Link2
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const MenuBar = ({ editor, isRu }: { editor: any; isRu: boolean }) => {
    if (!editor) {
        return null
    }

    const addImage = () => {
        editor.chain().focus().insertContent({ type: 'customImage', attrs: { src: '', alt: '', caption: '' } }).run()
    }

    const addVideo = () => {
        editor.chain().focus().insertContent({ type: 'customVideo', attrs: { src: '', caption: '' } }).run()
    }

    const addYoutube = () => {
        const url = window.prompt(isRu ? 'YouTube URL' : 'YouTube URL')
        if (url) {
            editor.commands.setYoutubeVideo({ src: url })
        }
    }

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href
        const url = window.prompt(isRu ? 'URL ссылки' : 'Link URL', previousUrl)

        if (url === null) {
            return
        }

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }

    return (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-zinc-900/80 border-b border-white/10 rounded-t-xl sticky top-0 z-10">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={`h-8 w-8 p-0 ${editor.isActive('bold') ? 'bg-white/10 text-white' : 'text-zinc-400'}`}
                title={isRu ? 'Жирный' : 'Bold'}
            >
                <Bold className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={`h-8 w-8 p-0 ${editor.isActive('italic') ? 'bg-white/10 text-white' : 'text-zinc-400'}`}
                title={isRu ? 'Курсив' : 'Italic'}
            >
                <Italic className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                disabled={!editor.can().chain().focus().toggleStrike().run()}
                className={`h-8 w-8 p-0 ${editor.isActive('strike') ? 'bg-white/10 text-white' : 'text-zinc-400'}`}
                title={isRu ? 'Зачеркнутый' : 'Strike'}
            >
                <Strikethrough className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleCode().run()}
                disabled={!editor.can().chain().focus().toggleCode().run()}
                className={`h-8 w-8 p-0 ${editor.isActive('code') ? 'bg-white/10 text-white' : 'text-zinc-400'}`}
                title={isRu ? 'Код' : 'Code'}
            >
                <Code className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-white/10 mx-1" />

            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`h-8 py-0 px-2 text-xs font-semibold ${editor.isActive('heading', { level: 1 }) ? 'bg-white/10 text-white' : 'text-zinc-400'}`}
            >
                H1
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`h-8 py-0 px-2 text-xs font-semibold ${editor.isActive('heading', { level: 2 }) ? 'bg-white/10 text-white' : 'text-zinc-400'}`}
            >
                H2
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`h-8 py-0 px-2 text-xs font-semibold ${editor.isActive('heading', { level: 3 }) ? 'bg-white/10 text-white' : 'text-zinc-400'}`}
            >
                H3
            </Button>

            <div className="w-px h-6 bg-white/10 mx-1" />

            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`h-8 w-8 p-0 ${editor.isActive('bulletList') ? 'bg-white/10 text-white' : 'text-zinc-400'}`}
            >
                <List className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`h-8 w-8 p-0 ${editor.isActive('orderedList') ? 'bg-white/10 text-white' : 'text-zinc-400'}`}
            >
                <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`h-8 w-8 p-0 ${editor.isActive('blockquote') ? 'bg-white/10 text-white' : 'text-zinc-400'}`}
            >
                <Quote className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-white/10 mx-1" />

            <Button variant="ghost" size="sm" onClick={setLink} className={`h-8 w-8 p-0 ${editor.isActive('link') ? 'bg-white/10 text-[#5EC8FF]' : 'text-zinc-400'}`}>
                <Link2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={addImage} className="h-8 w-8 p-0 text-zinc-400 hover:text-white">
                <ImageIcon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={addVideo} className="h-8 w-8 p-0 text-zinc-400 hover:text-white">
                <Video className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-white/10 mx-1" />

            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().chain().focus().undo().run()}
                className="h-8 w-8 p-0 text-zinc-400"
            >
                <Undo className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().chain().focus().redo().run()}
                className="h-8 w-8 p-0 text-zinc-400"
            >
                <Redo className="h-4 w-4" />
            </Button>
        </div>
    )
}

export function TipTapEditor({
    content,
    onChange,
    isRu,
    pageId
}: {
    content: string
    onChange: (html: string) => void
    isRu: boolean
    pageId?: string
}) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            CustomImage,
            CustomVideo,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-[#5EC8FF] underline underline-offset-4 decoration-white/20 hover:decoration-[#5EC8FF]',
                },
            }),
            Youtube.configure({
                HTMLAttributes: {
                    class: 'aspect-video w-full rounded-xl border border-white/10',
                },
            }),
        ],
        content,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'prose prose-invert prose-zinc max-w-none min-h-[400px] p-6 focus:outline-none prose-headings:font-semibold',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
    })

    return (
        <div data-page-id={pageId || ''} className="rounded-xl border border-white/10 bg-zinc-950/50 overflow-hidden focus-within:border-[#24A1DE]/40 transition duration-200">
            <MenuBar editor={editor} isRu={isRu} />
            <EditorContent editor={editor} />
        </div>
    )
}
