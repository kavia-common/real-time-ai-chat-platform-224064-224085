import React, { useMemo, useState } from 'react';
import { useChat } from '../store/chatStore';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * PUBLIC_INTERFACE
 * Sidebar shows conversation list and basic controls.
 */
export function Sidebar() {
  const { state, dispatch } = useChat();
  const [query, setQuery] = useState('');

  const conversations = useMemo(() => {
    return Object.values(state.conversations)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .filter((c) => c.title.toLowerCase().includes(query.toLowerCase()));
  }, [state.conversations, query]);

  return (
    <aside className="sidebar" aria-label="Conversations sidebar">
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button
          className="btn btn-primary"
          onClick={() => dispatch({ type: 'NEW_CONVERSATION' })}
          aria-label="Start a new chat"
        >
          + New chat
        </button>
        <button className="btn btn-ghost" aria-label="Sidebar settings">⋯</button>
      </div>
      <input
        className="input"
        placeholder="Search chats"
        aria-label="Search conversations"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {conversations.length === 0 ? (
          <div className="subtle" style={{ padding: 8 }}>No conversations</div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              className="btn"
              style={{
                justifyContent: 'space-between',
                textAlign: 'left',
                background: state.activeId === c.id ? 'rgba(37,99,235,0.08)' : undefined,
                borderColor: state.activeId === c.id ? 'rgba(37,99,235,0.35)' : undefined,
              }}
              onClick={() => dispatch({ type: 'SET_ACTIVE', id: c.id })}
              aria-label={`Open conversation ${c.title}`}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>
                {c.title}
              </span>
              <span className="subtle" style={{ fontSize: 12 }}>{formatDate(c.createdAt)}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
