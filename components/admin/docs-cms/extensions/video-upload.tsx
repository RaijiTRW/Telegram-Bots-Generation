import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { useState, useRef } from 'react'
import { VideoIcon, Loader2 } from 'lucide-react'


export const CustomVideo = Node.create({
    name: 'customVideo',

    group: 'block',

    draggable: true,

    addAttributes() {
        return {
            src: {
                default: '',
            },
            caption: {
                default: '',
            }
        }
    },

    parseHTML() {
        return [
            {
                tag: 'custom-video',
            },
            {
                tag: 'video[src]',
            }
        ]
    },

    renderHTML({ HTMLAttributes }) {
        if (!HTMLAttributes.src) {
            return ['custom-video', mergeAttributes(HTMLAttributes, { 'data-type': 'customVideo' })]
        }
        return ['video', mergeAttributes(HTMLAttributes, { 'data-type': 'customVideo', controls: true })]
    },

    addNodeView() {
        return ReactNodeViewRenderer(VideoUploadNodeView)
    },
})

function VideoUploadNodeView(props: any) {
    const { node, updateAttributes } = props
    const [isUploading, setIsUploading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleUpload = async (file: File) => {
        if (!file) return
        setIsUploading(true)

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('locale', 'ru')

            const pageIdElement = document.querySelector('[data-page-id]')
            if (pageIdElement) {
                const pageId = pageIdElement.getAttribute('data-page-id')
                if (pageId) formData.append('pageId', pageId)
            }

            const res = await fetch('/api/admin/docs/media', {
                method: 'POST',
                body: formData,
            })
            const response = await res.json()

            if (response.ok && response.data) {
                updateAttributes({
                    src: response.data.url,
                })
            } else {
                alert('Upload failed: ' + (response.error || 'Unknown error'))
            }
        } catch (e: any) {
            console.error(e)
            alert('Upload failed: ' + (e?.message || String(e)))
        } finally {
            setIsUploading(false)
        }
    }

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files[0])
        }
    }

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const onDragLeave = () => {
        setIsDragging(false)
    }

    if (node.attrs.src) {
        return (
            <NodeViewWrapper className="custom-video-wrapper my-4">
                <figure className="relative block">
                    <video
                        src={node.attrs.src}
                        controls
                        className="rounded-xl border border-white/10 w-full h-auto mx-auto"
                    />
                    {node.attrs.caption && (
                        <figcaption className="text-sm text-zinc-400 text-center mt-2">
                            {node.attrs.caption}
                        </figcaption>
                    )}
                </figure>
            </NodeViewWrapper>
        )
    }

    return (
        <NodeViewWrapper className="custom-video-wrapper my-4">
            <div
                className={`w-full p-8 rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-3 cursor-pointer select-none
          ${isDragging ? 'border-[#24A1DE] bg-[#24A1DE]/5' : 'border-white/20 hover:border-white/40 bg-zinc-950/30'}
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                contentEditable={false}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="video/*"
                    onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                            handleUpload(e.target.files[0])
                        }
                    }}
                />
                {isUploading ? (
                    <>
                        <Loader2 className="w-8 h-8 text-[#24A1DE] animate-spin" />
                        <p className="text-sm text-zinc-400 font-medium">Загрузка видео...</p>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-zinc-400">
                            <VideoIcon className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-zinc-200">Выберите видео или перетащите сюда</p>
                            <p className="text-xs text-zinc-500 mt-1">MP4, WEBM до 500MB</p>
                        </div>
                    </>
                )}
            </div>
        </NodeViewWrapper>
    )
}
