import React, { useCallback, useRef, useState } from 'react';

/**
 * PUBLIC_INTERFACE
 * Chat composer: textarea with keyboard controls and send button.
 */
export function ChatComposer({ disabled, onSend }) {
  const [text, setText] = useState('');
  const taRef = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (text.trim() && !disabled) {
          onSend(text.trim());
          setText('');
        }
      }
    },
    [text, disabled, onSend]
  );

  const handleClick = useCallback(() => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      if (taRef.current) taRef.current.focus();
    }
  }, [text, disabled, onSend]);

  const maxChars = 4000;

  return (
    <div className="composer" aria-label="Message composer">
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <button className="btn" aria-label="Attach a file (placeholder)" title="Attachments coming soon" disabled>
          📎
        </button>
        <div style={{ flex: 1 }}>
          <textarea
            ref={taRef}
            className="textarea"
            rows={3}
            placeholder="Message Ocean Chat..."
            aria-label="Type your message"
            value={text}
            maxLength={maxChars}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span className="subtle" style={{ fontSize: 12 }}>Enter to send • Shift+Enter for newline</span>
            <span className="subtle" style={{ fontSize: 12 }}>{text.length}/{maxChars}</span>
          </div>
        </div>
        <button
          className="btn btn-primary"
          aria-label="Send message"
          onClick={handleClick}
          disabled={disabled || !text.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
