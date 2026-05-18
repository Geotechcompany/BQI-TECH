"use client"

import { format } from "date-fns"
import { CalendarIcon, Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function parseBlogPostDate(iso: string): Date | undefined {
  if (!iso) return undefined
  const dateOnly = String(iso).match(/^(\d{4}-\d{2}-\d{2})/)
  if (dateOnly) {
    const [y, m, d] = dateOnly[1].split("-").map(Number)
    return new Date(y, m - 1, d)
  }
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function formatBlogPostDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** YYYY-MM-DD string from ISO createdAt (for API payloads). */
export function toDateInputValue(iso: string): string {
  const d = parseBlogPostDate(iso)
  return d ? formatBlogPostDate(d) : ""
}

interface BlogCreatedAtPickerProps {
  value: string
  onSelect: (dateValue: string) => void | Promise<void>
  disabled?: boolean
  saving?: boolean
}

export function BlogCreatedAtPicker({
  value,
  onSelect,
  disabled = false,
  saving = false,
}: BlogCreatedAtPickerProps) {
  const [open, setOpen] = useState(false)
  const selected = parseBlogPostDate(value)

  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || saving}
            className={cn(
              "w-full justify-start text-left font-normal h-9",
              !selected && "text-muted-foreground"
            )}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CalendarIcon className="mr-2 h-4 w-4" />
            )}
            {selected ? format(selected, "MMM d, yyyy") : "Pick date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              if (!date) return
              const next = formatBlogPostDate(date)
              if (next === value) {
                setOpen(false)
                return
              }
              void Promise.resolve(onSelect(next)).then(() => setOpen(false))
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
