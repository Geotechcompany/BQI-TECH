"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { ReactNode, useEffect } from "react"
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Undo, 
  Redo, 
  Code,
  Heading1,
  Heading2,
  Link as LinkIcon,
  Image as ImageIcon,
  Loader2,
  Strikethrough,
  Type,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { authService } from "@/lib/auth-backend"
import { BACKEND_URL } from '@/lib/config'

interface EditorProps {
  value: string
  onChange: (value: string) => void
  toolbarAccessory?: ReactNode
  footer?: ReactNode
  className?: string
  contentClassName?: string
}

const MenuBar = ({
  editor,
  isUploading,
  accessory,
}: {
  editor: any
  isUploading: boolean
  accessory?: ReactNode
}) => {
  if (!editor) {
    return null
  }

  const addLink = () => {
    const url = window.prompt('Enter URL')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const handleImageUpload = async (file: File) => {
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPEG, PNG, or WebP)')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      const uploadUrl = `${BACKEND_URL}/api/upload/`
      const response = await authService.authenticatedFetch(uploadUrl, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Upload failed')
      }

      const data = await response.json()
      editor.chain().focus().setImage({ src: data.url, alt: file.name }).run()
      toast.success('Image uploaded successfully')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload image')
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-[#272055]/10 bg-[#fafbfd] p-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          variant={editor.isActive('paragraph') ? 'secondary' : 'ghost'}
          size="sm"
          title="Paragraph"
        >
          <Type className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
          size="sm"
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
          size="sm"
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          variant={editor.isActive('strike') ? 'secondary' : 'ghost'}
          size="sm"
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          disabled={!editor.can().chain().focus().toggleHeading({ level: 1 }).run()}
          variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
          size="sm"
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={!editor.can().chain().focus().toggleHeading({ level: 2 }).run()}
          variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
          size="sm"
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={!editor.can().chain().focus().toggleBulletList().run()}
          variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
          size="sm"
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={!editor.can().chain().focus().toggleOrderedList().run()}
          variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
          size="sm"
          title="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          disabled={!editor.can().chain().focus().toggleBlockquote().run()}
          variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
          size="sm"
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          variant={editor.isActive('code') ? 'secondary' : 'ghost'}
          size="sm"
          title="Code"
        >
          <Code className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          onClick={addLink}
          variant={editor.isActive('link') ? 'secondary' : 'ghost'}
          size="sm"
          title="Link"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <div className="relative">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            disabled={isUploading}
          />
          <Button 
            type="button"
            variant="ghost"
            size="sm"
            disabled={isUploading}
            title="Image"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
        <Button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          variant="ghost"
          size="sm"
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          variant="ghost"
          size="sm"
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>
      {accessory ? <div className="w-full shrink-0 sm:w-auto">{accessory}</div> : null}
    </div>
  )
}

export function Editor({
  value,
  onChange,
  toolbarAccessory,
  footer,
  className,
  contentClassName,
}: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline'
        }
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto my-8'
        }
      })
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value, false)
    }
  }, [editor, value])

  return (
    <div className={cn("relative min-h-[420px] w-full overflow-hidden rounded-xl border border-[#272055]/10 bg-white", className)}>
      <MenuBar editor={editor} isUploading={false} accessory={toolbarAccessory} />
      <div
        className={cn(
          "min-h-[360px] p-4 prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none prose-img:rounded-lg prose-img:mx-auto",
          contentClassName
        )}
      >
        <EditorContent editor={editor} />
      </div>
      {footer ? (
        <div className="border-t border-[#272055]/10 px-4 py-3">{footer}</div>
      ) : null}
    </div>
  )
}
