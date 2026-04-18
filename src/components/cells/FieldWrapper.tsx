import React from 'react'

type FieldWrapperProps = {
  label:     string
  required?: boolean
  error?:    string
  hint?:     string
  children:  React.ReactNode
  className?: string
}

/**
 * FieldWrapper — renders a label, the field, and an error message.
 *
 * Used internally by ReaktiformPanel's details form.
 * Also exported from `reaktiform/cells` so headless consumers can
 * build consistent form UIs with the same label/error pattern.
 *
 * @example
 * <FieldWrapper label="Project Name" required error={errors.name}>
 *   <TextCellEdit value={name} onCommit={setName} onCancel={() => {}} />
 * </FieldWrapper>
 */
export function FieldWrapper({
  label,
  required,
  error,
  hint,
  children,
  className,
}: FieldWrapperProps) {
  return (
    <div
      data-reaktiform
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           4,
      }}
      className={className}
    >
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={{
          fontSize:   12,
          fontWeight: 600,
          color:      'var(--rf-text-2, #4B5563)',
          lineHeight: 1,
        }}>
          {label}
        </label>
        {required && (
          <span style={{ color: 'var(--rf-err, #EF4444)', fontSize: 11, lineHeight: 1 }}>
            *
          </span>
        )}
      </div>

      {/* Input slot */}
      <div style={{
        height:       36,
        border:       `1px solid ${error ? 'var(--rf-err, #EF4444)' : 'var(--rf-border, #E2E8F0)'}`,
        borderRadius: 6,
        overflow:     'hidden',
        background:   error ? 'var(--rf-err-bg, #FEF2F2)' : 'var(--rf-surface, #fff)',
        transition:   'border-color 120ms ease',
      }}>
        {children}
      </div>

      {/* Error message */}
      {error && (
        <span style={{
          fontSize:  11,
          color:     'var(--rf-err, #EF4444)',
          lineHeight: 1.3,
        }}>
          {error}
        </span>
      )}

      {/* Hint text */}
      {hint && !error && (
        <span style={{
          fontSize:  11,
          color:     'var(--rf-text-3, #9CA3AF)',
          lineHeight: 1.3,
        }}>
          {hint}
        </span>
      )}
    </div>
  )
}
