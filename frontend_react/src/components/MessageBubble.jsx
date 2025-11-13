import React from 'react';
import { Markdown } from '../utils/markdown.jsx';

/**
 * PUBLIC_INTERFACE
 * Render a single chat message bubble with role-specific styling.
 */
export function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`} role="article" aria-label={`${message.role} message`}>
      <div className="avatar" aria-hidden>{isUser ? 'U' : 'A'}</div>
      <div className="bubble">
        <div className="role">{isUser ? 'You' : 'Assistant'}</div>
        {isUser ? (
          <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
        ) : (
          <Markdown content={message.content} />
        )}
      </div>
    </div>
  );
}
