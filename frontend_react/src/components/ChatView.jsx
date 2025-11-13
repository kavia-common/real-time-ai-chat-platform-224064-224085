import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useChat, getActiveConversation, getMessagesForConversation } from '../store/chatStore';
import { postJson, mockStream } from '../api/client.js';
import { MessageBubble } from './MessageBubble';
import { ChatComposer } from './ChatComposer';
import { TalkToAI } from './TalkToAI.jsx';

// Toggle mock streaming
const STREAMING_PLACEHOLDER = true;

/**
 * PUBLIC_INTERFACE
 * Chat view: message list and composer with mock streaming for assistant.
 */
export function ChatView() {
  const { state, dispatch } = useChat();
  const active = getActiveConversation(state);
  const messages = useMemo(() => (active ? getMessagesForConversation(state, active.id) : []), [state, active && active.id]);

  const [sending, setSending] = useState(false);
  const streamAbortRef = useRef(null);
  const scrollerRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [messages.length]);

  const ensureConversation = () => {
    if (!active) dispatch({ type: 'NEW_CONVERSATION' });
  };

  const setTitleIfNeeded = (text) => {
    const conv = getActiveConversation({ ...state, activeId: active ? active.id : null });
    if (conv && conv.title === 'New chat') {
      const title = text.slice(0, 40) + (text.length > 40 ? '…' : '');
      dispatch({ type: 'RENAME_CONVERSATION', id: conv.id, title });
    }
  };

  const handleSend = async (text) => {
    ensureConversation();
    // Slight delay to ensure active is present after NEW_CONVERSATION dispatch
    await new Promise((r) => setTimeout(r, 0));
    const recentActiveId = active ? active.id : Object.keys(state.conversations).slice(-1)[0] || null;
    const conv = getActiveConversation({ ...state, activeId: recentActiveId }) || getActiveConversation(state);
    const conversationId = conv ? conv.id : state.activeId;

    const userMsg = {
      id: 'm_' + Math.random().toString(36).slice(2),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_MESSAGE', conversationId, message: userMsg });
    setTitleIfNeeded(text);

    const assistantId = 'm_' + Math.random().toString(36).slice(2);
    const assistantMsg = {
      id: assistantId,
      role: 'assistant',
      content: STREAMING_PLACEHOLDER ? '' : '…',
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_MESSAGE', conversationId, message: assistantMsg });

    setSending(true);
    try {
      // Call API or mock
      const payload = { messages: messages.concat(userMsg).map((m) => ({ role: m.role, content: m.content })) };
      const res = await postJson('/v1/chat/completions', payload, {
        mock: !process.env.REACT_APP_API_BASE && !process.env.REACT_APP_BACKEND_URL,
      });

      if (STREAMING_PLACEHOLDER) {
        // stream the result content
        streamAbortRef.current = mockStream(
          res.content,
          (chunk) => {
            const prev = (state.messages[assistantId] && state.messages[assistantId].content) || '';
            dispatch({ type: 'UPDATE_MESSAGE', id: assistantId, patch: { content: prev + chunk } });
          },
          () => {
            setSending(false);
            streamAbortRef.current = null;
          }
        );
      } else {
        dispatch({ type: 'UPDATE_MESSAGE', id: assistantId, patch: { content: res.content } });
        setSending(false);
      }
    } catch (e) {
      dispatch({
        type: 'UPDATE_MESSAGE',
        id: assistantId,
        patch: { content: 'Sorry, something went wrong. Please try again.' },
      });
      setSending(false);
      console.error('chat error', e);
    }
  };

  useEffect(() => {
    // Initialize with a conversation if none
    if (!active && Object.keys(state.conversations).length === 0) {
      dispatch({ type: 'NEW_CONVERSATION' });
    }
  }, [active, state.conversations, dispatch]);

  return (
    <div className="chat-main" aria-live="polite">
      <div ref={scrollerRef} className="chat-stream" role="log" aria-label="Chat messages">
        {messages.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--muted-text)',
            }}
          >
            Start by sending a message.
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
      </div>
      <div className="composer" style={{ paddingTop: 8 }}>
        <TalkToAI />
        <ChatComposer disabled={sending} onSend={handleSend} />
      </div>
    </div>
  );
}
