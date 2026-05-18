"use client"

import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TiptapImage from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import { NodeSelection } from "@tiptap/pm/state"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo,
  Sparkles,
  Strikethrough,
  Trash2,
  Undo,
  CodeXml,
  Eye,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { authService } from "@/lib/auth-backend"
import { BACKEND_URL } from "@/lib/config"

type EditorViewMode = "visual" | "html"

interface EditorProps {
  value: string
  onChange: (value: string) => void
  variant?: "default" | "blog"
  onAiFormat?: () => void | Promise<void>
  aiFormatting?: boolean
  /** Show visual / HTML source toggle (default: true for blog variant) */
  showHtmlToggle?: boolean
}

export function normalizeBlogHtml(html: string): string {
  if (!html) return ""
  return html
    .replace(
      /<figure[^>]*>\s*<img([^>]+)\/?>\s*<\/figure>/gi,
      "<img$1 />"
    )
    .replace(/<img([^>]*?)\s*\/?>/gi, (match, attrs) => {
      if (/draggable=/i.test(attrs)) return match
      return `<img${attrs} draggable="true" />`
    })
}

const DraggableImage = TiptapImage.extend({
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      draggable: {
        default: true,
        parseHTML: () => true,
        renderHTML: () => ({ draggable: "true" }),
      },
    }
  },
  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (node) => {
          const element = node as HTMLElement
          const img = element.querySelector("img")
          if (!img) return false
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt") || "",
            title: img.getAttribute("title") || "",
          }
        },
      },
      {
        tag: "img[src]",
        getAttrs: (element) => {
          const img = element as HTMLImageElement
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt") || "",
            title: img.getAttribute("title") || "",
          }
        },
      },
    ]
  },
}).configure({
  inline: false,
  allowBase64: false,
  HTMLAttributes: {
    class:
      "rounded-lg max-w-full h-auto my-6 mx-auto block cursor-grab active:cursor-grabbing ring-0 hover:ring-2 hover:ring-primary/40 transition-shadow",
    draggable: "true",
  },
})

function moveSelectedBlock(editor: TiptapEditor, direction: "up" | "down") {
  const { state, view } = editor
  const { selection } = state

  let nodePos: number | null = null
  let node = null

  if (selection instanceof NodeSelection && selection.node?.type?.name === "image") {
    nodePos = selection.from
    node = selection.node
  } else {
    state.doc.nodesBetween(selection.from, selection.to, (n, p) => {
      if (n.type.name === "image" && node === null) {
        node = n
        nodePos = p
        return false
      }
    })
  }

  if (nodePos === null || !node) {
    toast.message("Select an image first, then use ↑ or ↓ to move it between sections.")
    return
  }

  const $pos = state.doc.resolve(nodePos)
  const index = $pos.index()
  const parent = $pos.parent
  const targetIndex = direction === "up" ? index - 1 : index + 1

  if (targetIndex < 0 || targetIndex >= parent.childCount) {
    toast.message(
      direction === "up" ? "Image is already at the top." : "Image is already at the bottom."
    )
    return
  }

  let insertPos = $pos.posAtIndex(targetIndex)
  if (targetIndex > index) {
    insertPos += parent.child(targetIndex).nodeSize
  }

  const tr = state.tr
  tr.delete(nodePos, nodePos + node.nodeSize)
  const mappedInsert = tr.mapping.map(insertPos)
  tr.insert(mappedInsert, node)
  tr.setSelection(NodeSelection.create(tr.doc, mappedInsert))
  view.dispatch(tr.scrollIntoView())
  editor.commands.focus()
}

function useDragAutoScroll(scrollRef: React.RefObject<HTMLDivElement | null>) {
  const onDragOver = useCallback(
    (event: DragEvent) => {
      const container = scrollRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const edge = 72
      const speed = 18
      if (event.clientY < rect.top + edge) {
        container.scrollTop -= speed
      } else if (event.clientY > rect.bottom - edge) {
        container.scrollTop += speed
      }
    },
    [scrollRef]
  )

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    container.addEventListener("dragover", onDragOver)
    return () => container.removeEventListener("dragover", onDragOver)
  }, [scrollRef, onDragOver])
}

function ToolButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      variant={active ? "secondary" : "ghost"}
      size="sm"
      title={title}
      aria-label={title}
    >
      {children}
    </Button>
  )
}

const MenuBar = ({
  editor,
  isUploading,
  onAiFormat,
  aiFormatting,
  viewMode,
  onToggleViewMode,
  showHtmlToggle,
}: {
  editor: TiptapEditor | null
  isUploading: boolean
  onAiFormat?: () => void | Promise<void>
  aiFormatting?: boolean
  viewMode: EditorViewMode
  onToggleViewMode: () => void
  showHtmlToggle: boolean
}) => {
  const [imageActive, setImageActive] = useState(false)

  useEffect(() => {
    if (!editor) return
    const update = () => setImageActive(editor.isActive("image"))
    update()
    editor.on("selectionUpdate", update)
    editor.on("transaction", update)
    return () => {
      editor.off("selectionUpdate", update)
      editor.off("transaction", update)
    }
  }, [editor])

  if (!editor && viewMode === "visual") return null

  const addLink = () => {
    if (!editor) return
    const previous = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Enter URL", previous || "https://")
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  const handleImageUpload = async (file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid image file (JPEG, PNG, or WebP)")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB")
      return
    }

    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await authService.authenticatedFetch(
        `${BACKEND_URL}/api/upload/`,
        { method: "POST", body: formData }
      )
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Upload failed")
      }
      const data = await response.json()
      if (!editor) return
      editor.chain().focus().setImage({ src: data.url, alt: file.name }).run()
      toast.success("Image inserted — drag it or use ↑ ↓ to reposition.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image"
      )
    }
  }

  if (viewMode === "html") {
    return (
      <div className="border-b border-input bg-muted/30 rounded-t-md p-1 flex flex-col gap-1 sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-0.5">
          <span className="text-xs text-muted-foreground">
            HTML source — edit tags directly. Switch back to Visual to preview.
          </span>
          {showHtmlToggle && (
            <ToolButton title="Visual editor" onClick={onToggleViewMode} active>
              <Eye className="h-4 w-4" />
            </ToolButton>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-input bg-muted/30 rounded-t-md p-1 flex flex-col gap-1 sticky top-0 z-10 backdrop-blur-sm">
      <div className="flex flex-wrap gap-1 items-center">
        <ToolButton title="Bold" onClick={() => editor!.chain().focus().toggleBold().run()} active={editor!.isActive("bold")}>
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}>
          <Strikethrough className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })}>
          <Heading1 className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>
          <Heading2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>
          <Heading3 className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>
          <List className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>
          <ListOrdered className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}>
          <Quote className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}>
          <Code className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Align left" onClick={() => editor.chain().focus().updateAttributes("paragraph", { style: "text-align: left" }).run()}>
          <AlignLeft className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Align center" onClick={() => editor.chain().focus().updateAttributes("paragraph", { style: "text-align: center" }).run()}>
          <AlignCenter className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Align right" onClick={() => editor.chain().focus().updateAttributes("paragraph", { style: "text-align: right" }).run()}>
          <AlignRight className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Link" onClick={addLink} active={editor.isActive("link")}>
          <LinkIcon className="h-4 w-4" />
        </ToolButton>
        <div className="relative">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImageUpload(file)
              e.target.value = ""
            }}
            disabled={isUploading}
          />
          <ToolButton title="Insert image" onClick={() => undefined} disabled={isUploading}>
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          </ToolButton>
        </div>
        <ToolButton title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().chain().focus().undo().run()}>
          <Undo className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().chain().focus().redo().run()}>
          <Redo className="h-4 w-4" />
        </ToolButton>
        {onAiFormat && (
          <ToolButton
            title="Format sections with AI"
            onClick={() => void onAiFormat()}
            disabled={aiFormatting}
          >
            {aiFormatting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 text-violet-600" />
            )}
          </ToolButton>
        )}
        {showHtmlToggle && (
          <>
            <div className="w-px h-6 bg-border mx-0.5 self-center" aria-hidden />
            <ToolButton title="Edit HTML source" onClick={onToggleViewMode}>
              <CodeXml className="h-4 w-4" />
            </ToolButton>
          </>
        )}
      </div>

      {imageActive && editor && (
        <div className="flex flex-wrap items-center gap-1 px-1 py-1 border-t border-input/60 bg-background/80 rounded-md">
          <span className="text-xs text-muted-foreground mr-1">Image:</span>
          <ToolButton title="Move image up" onClick={() => moveSelectedBlock(editor, "up")}>
            <ArrowUp className="h-4 w-4" />
          </ToolButton>
          <ToolButton title="Move image down" onClick={() => moveSelectedBlock(editor, "down")}>
            <ArrowDown className="h-4 w-4" />
          </ToolButton>
          <ToolButton title="Delete image" onClick={() => editor.chain().focus().deleteSelection().run()}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </ToolButton>
          <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">
            Drag the image, or use arrows. The editor scrolls when you drag near the top or bottom edge.
          </span>
        </div>
      )}
    </div>
  )
}

export function Editor({
  value,
  onChange,
  variant = "default",
  onAiFormat,
  aiFormatting = false,
  showHtmlToggle: showHtmlToggleProp,
}: EditorProps) {
  const [isUploading] = useState(false)
  const [viewMode, setViewMode] = useState<EditorViewMode>("visual")
  const [htmlDraft, setHtmlDraft] = useState("")
  const viewModeRef = useRef<EditorViewMode>("visual")
  const scrollRef = useRef<HTMLDivElement>(null)
  viewModeRef.current = viewMode
  const normalizedValue = normalizeBlogHtml(value)
  const showHtmlToggle = showHtmlToggleProp ?? variant === "blog"
  useDragAutoScroll(scrollRef)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline" },
      }),
      DraggableImage,
    ],
    content: normalizedValue,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[320px] px-1",
      },
      handleDOMEvents: {
        dragover: (_view, event) => {
          const container = scrollRef.current
          if (!container) return false
          const rect = container.getBoundingClientRect()
          const edge = 72
          const speed = 18
          if (event.clientY < rect.top + edge) container.scrollTop -= speed
          else if (event.clientY > rect.bottom - edge) container.scrollTop += speed
          return false
        },
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (viewModeRef.current === "visual") {
        onChange(ed.getHTML())
      }
    },
  })

  const toggleViewMode = useCallback(() => {
    if (viewMode === "visual") {
      const html = editor?.getHTML() ?? normalizedValue
      setHtmlDraft(html)
      setViewMode("html")
      return
    }
    const next = normalizeBlogHtml(htmlDraft)
    onChange(next)
    if (editor) {
      editor.commands.setContent(next, false)
    }
    setViewMode("visual")
  }, [viewMode, editor, normalizedValue, htmlDraft, onChange])

  useEffect(() => {
    if (viewMode !== "visual" || !editor) return
    const next = normalizeBlogHtml(value)
    if (next !== normalizeBlogHtml(editor.getHTML())) {
      editor.commands.setContent(next, false)
    }
  }, [value, editor, viewMode])

  useEffect(() => {
    if (viewMode !== "html") return
    const next = normalizeBlogHtml(value)
    if (next !== htmlDraft) {
      setHtmlDraft(next)
    }
  }, [value, viewMode, htmlDraft])

  useEffect(() => {
    if (!editor) return
    const onDragOver = (event: DragEvent) => {
      const margin = 72
      const step = 16
      if (event.clientY < margin) {
        window.scrollBy({ top: -step, behavior: "auto" })
      } else if (event.clientY > window.innerHeight - margin) {
        window.scrollBy({ top: step, behavior: "auto" })
      }
    }
    const root = editor.view.dom
    root.addEventListener("dragover", onDragOver)
    return () => root.removeEventListener("dragover", onDragOver)
  }, [editor])

  const isBlog = variant === "blog"

  return (
    <div
      className={cn(
        "relative w-full border rounded-md flex flex-col bg-background",
        isBlog && "max-h-[min(78vh,900px)]"
      )}
    >
      <MenuBar
        editor={editor}
        isUploading={isUploading}
        onAiFormat={onAiFormat}
        aiFormatting={aiFormatting}
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
        showHtmlToggle={showHtmlToggle}
      />
      <div
        ref={scrollRef}
        className={cn(
          "overflow-y-auto overscroll-contain",
          viewMode === "html" ? "p-0" : "p-4",
          isBlog ? "flex-1 min-h-[420px] max-h-[calc(78vh-120px)]" : "min-h-[500px] max-h-[70vh]"
        )}
      >
        {viewMode === "html" ? (
          <Textarea
            value={htmlDraft}
            onChange={(e) => {
              const next = e.target.value
              setHtmlDraft(next)
              onChange(next)
            }}
            spellCheck={false}
            className={cn(
              "min-h-[420px] font-mono text-sm border-0 rounded-none resize-y focus-visible:ring-0",
              isBlog ? "min-h-[calc(78vh-160px)]" : "min-h-[480px]"
            )}
            placeholder="<p>Your HTML content...</p>"
          />
        ) : (
          <EditorContent
            editor={editor}
            className="[&_.ProseMirror]:outline-none [&_.ProseMirror_img]:cursor-grab [&_.ProseMirror_img.ProseMirror-selectednode]:cursor-grabbing [&_.ProseMirror_img.ProseMirror-selectednode]:ring-2 [&_.ProseMirror_img.ProseMirror-selectednode]:ring-primary/50 [&_.ProseMirror-selectednode]:rounded-lg"
          />
        )}
      </div>
    </div>
  )
}