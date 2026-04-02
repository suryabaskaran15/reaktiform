import React, { useRef, useEffect } from 'react'
import { cn } from '../../utils'

// ── READ MODE
type TextCellReadProps = {
  value: string | null | undefined
  placeholder?: string
  className?: string
  multiline?: boolean
}

export function TextCellRead({
  value,
  placeholder = 'Click to enter…',
  className,
}: TextCellReadProps) {
  return (
    <div className={cn('flex items-center px-[10px] h-full min-w-0', className)}>
      {value ? (
        <span
          className="text-[13px] text-rf-text-1 overflow-hidden text-ellipsis whitespace-nowrap w-full"
          title={value}
        >
          {value}
        </span>
      ) : (
        <span className="text-[12px] text-rf-text-3 italic">{placeholder}</span>
      )}
    </div>
  )
}

// ── EDIT MODE
type TextCellEditProps = {
  value: string | null | undefined
  placeholder?: string
  autoFocus?: boolean
  multiline?: boolean
  rows?: number
  onCommit: (value: string) => void
  onCancel: () => void
  className?: string
}

export function TextCellEdit({
  value,
  placeholder,
  autoFocus = true,
  multiline = false,
  rows = 3,
  onCommit,
  onCancel,
  className,
}: TextCellEditProps) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus()
      ref.current.select()
    }
  }, [autoFocus])

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    if (!multiline && e.key === 'Enter') { e.preventDefault(); onCommit(ref.current?.value ?? '') }
    if (e.key === 'Tab') { e.preventDefault(); onCommit(ref.current?.value ?? '') }
  }

  const baseClass = cn(
    'w-full border-none outline-none bg-transparent',
    'font-[var(--rf-font-sans)] text-[13px] text-rf-text-1',
    'placeholder:text-rf-text-3',
    className
  )

  if (multiline) {
    return (
      <textarea
        ref={ref as React.RefObject<HTMLTextAreaElement>}
        defaultValue={value ?? ''}
        placeholder={placeholder}
        rows={rows}
        className={cn(baseClass, 'resize-none py-2 px-[10px] leading-relaxed')}
        onKeyDown={handleKeyDown}
        onBlur={(e) => onCommit(e.target.value)}
      />
    )
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      type="text"
      defaultValue={value ?? ''}
      placeholder={placeholder}
      className={cn(baseClass, 'px-[10px] h-full')}
      onKeyDown={handleKeyDown}
      onBlur={(e) => onCommit(e.target.value)}
    />
  )
}
