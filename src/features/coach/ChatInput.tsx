// src/features/coach/ChatInput.tsx

import { useState, useRef, type KeyboardEvent } from 'react'
import { Camera } from '@phosphor-icons/react'

const MAX_LENGTH = 500

const QUICK_ACTIONS = [
  { label: 'מה לתרגל עכשיו?', icon: '📋' },
  { label: 'פירוש מילה?', icon: '📖' },
  { label: 'יש לי בעיה', icon: '💬' },
]

interface Props {
  onSend: (text: string) => void
  onImageCapture?: (file: File) => void
  disabled?: boolean
  showSuggestions?: boolean
}

export default function ChatInput({ onSend, onImageCapture, disabled, showSuggestions = true }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleQuickAction = (label: string) => {
    if (disabled) return
    onSend(label)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 80) + 'px'
  }

  const handleChange = (value: string) => {
    if (value.length > MAX_LENGTH) {
      setText(value.slice(0, MAX_LENGTH))
    } else {
      setText(value)
    }
  }

  const handleCameraClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onImageCapture) {
      onImageCapture(file)
    }
    // Reset input so the same file can be selected again
    if (e.target) e.target.value = ''
  }

  const isNearLimit = text.length > MAX_LENGTH * 0.9

  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{
        borderTop: '1px solid rgba(107,63,160,0.08)',
        background: 'rgba(255,255,255,0.5)',
        overflow: 'hidden',
        maxWidth: '100%',
      }}
    >
      {/* Quick action suggestions */}
      {showSuggestions && !text && (
        <div
          className="flex gap-1.5 overflow-x-auto"
          style={{ padding: '8px 12px 4px', scrollbarWidth: 'none' }}
        >
          {QUICK_ACTIONS.map(({ label, icon }) => (
            <button
              key={label}
              onClick={() => handleQuickAction(label)}
              disabled={disabled}
              /* znk-tooltip on the chip itself — bubbles open above the
                 chips so they don't get clipped by the chat panel edge. */
              className="flex-shrink-0 flex items-center gap-1 rounded-full text-[11.5px] font-medium transition-[transform,box-shadow,background-color,border-color,opacity] active:scale-95 disabled:opacity-40 hover:shadow-md znk-tooltip"
              style={{
                padding: '5px 12px',
                background: 'white',
                border: '1.5px solid rgba(107,63,160,0.15)',
                color: '#6B3FA0',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="znk-tip" data-placement="top" role="tooltip">
                שאלה מוכנה — קליק שולח אותה לצוות
              </span>
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Character limit warning */}
      {isNearLimit && (
        <div className="text-[10px] text-right px-3 pt-1" style={{ color: text.length >= MAX_LENGTH ? '#E91E78' : '#9CA3AF' }}>
          {text.length}/{MAX_LENGTH}
        </div>
      )}

      <div
        className="flex items-end gap-2"
        style={{ padding: '8px 12px 12px' }}
      >
        {/* Camera button */}
        {onImageCapture && (
          <button
            onClick={handleCameraClick}
            disabled={disabled}
            className="flex-shrink-0 flex items-center justify-center rounded-full transition-[transform,box-shadow,background-color,border-color,opacity] active:scale-90 disabled:opacity-40 znk-tooltip"
            style={{
              width: 34, height: 34,
              background: 'white',
              border: '1.5px solid rgba(107,63,160,0.15)',
              color: '#6B3FA0',
            }}
            aria-label="צלם טקסט לתרגום"
          >
            <span className="znk-tip" data-placement="top" role="tooltip">
              צלם דף או מסך — נחלץ ממנו מילים ונתרגם
            </span>
            <Camera weight="bold" size={18} />
          </button>
        )}

        {/* Hidden file input for camera */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <div
          className="flex-1 flex items-end rounded-2xl transition-colors"
          style={{
            background: 'white',
            border: '1.5px solid rgba(107,63,160,0.15)',
            padding: '4px 6px 4px 14px',
            boxShadow: '2px 2px 8px rgba(130,120,160,0.06)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => handleChange(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="כתוב הודעה לצוות..."
            rows={1}
            disabled={disabled}
            maxLength={MAX_LENGTH}
            className="flex-1 border-none outline-none resize-none bg-transparent text-[13px] leading-snug"
            style={{
              fontFamily: "'Heebo', sans-serif",
              padding: '6px 0',
              maxHeight: 80,
              minHeight: 20,
              direction: 'rtl',
              color: '#332F3A',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              // Prevent iOS zoom on focus (font-size < 16px triggers zoom)
              fontSize: 16,
            }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="flex-shrink-0 flex items-center justify-center rounded-full text-white transition-[transform,box-shadow,background-color,border-color,opacity] active:scale-90 disabled:opacity-40 znk-tooltip"
          style={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, #6B3FA0, #4F3A8B)',
            boxShadow: '0 3px 10px rgba(107,63,160,0.3)',
          }}
          aria-label="שלח הודעה"
        >
          <span className="znk-tip" data-placement="top" role="tooltip">
            שלח לצוות — Enter גם שולח
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}>
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
