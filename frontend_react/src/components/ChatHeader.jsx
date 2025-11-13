import React from 'react';
import { useChat, getActiveConversation } from '../store/chatStore';

/**
 * PUBLIC_INTERFACE
 * Chat header shows title and connection status placeholder.
 */
export function ChatHeader() {
  const { state } = useChat();
  const active = getActiveConversation(state);

  const status = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_BACKEND_URL) ? 'online' : 'mock';

  return (
    <header className="header gradient-bg" aria-label="Chat header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          aria-hidden
          style={{
            width: 10, height: 10, borderRadius: 999,
            background: status === 'online' ? 'var(--success)' : 'var(--secondary)',
            boxShadow: '0 0 0 3px rgba(37,99,235,0.15)',
          }}
        />
        <strong>Ocean Chat</strong>
        <span className="subtle">/ {active ? active.title : 'No conversation'}</span>
      </div>
      <div className="subtle" aria-live="polite">
        {status === 'online' ? 'Connected' : 'Mock mode'}
      </div>
    </header>
  );
}
