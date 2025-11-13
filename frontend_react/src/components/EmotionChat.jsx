import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat, getActiveConversation, getMessagesForConversation } from '../store/chatStore';
import { postJson, mockStream } from '../api/client';
import { predictEmotion, toneAdjust } from '../utils/aiModel';

/**
 * PUBLIC_INTERFACE
 * EmotionChat: A drop-in ChatView variant that runs a tiny local emotion model on the user's text,
 * adjusts the assistant reply tone, and can optionally speak the reply using SpeechSynthesis.
 *
 * Feature flag:
 * - Enable with REACT_APP_FEATURE_FLAGS="emotion=true" (default off).
 *
 * Security/Privacy:
 * - All emotion inference is local in the browser; no secrets or PII are logged.
 *
 * Upgrade Note:
 * - For production-grade usage, move emotion classification to a server-side endpoint with
 *   environment-driven base URL (REACT_APP_API_BASE) and authentication, returning emotion/tone only.
 */
export function EmotionChat() {
  const { state, dispatch } = useChat();
  const active = getActiveConversation(state);
  const messages = useMemo(() => (active ? getMessagesForConversation(state, active.id) : []), [state, active && active.id]);

  const [sending, setSending] = useState(false);
  const [tts, setTts] = useState(() => {
    // default enabled only if feature flag sets it; otherwise false
    const flags = (process.env.REACT_APP_FEATURE_FLAGS || '').toString();
    const map = new Map(
      flags
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => {
          const [k, v = 'true'] = s.split('=');
          return [k.trim(), v.trim()];
        })
    );
    const v = map.get('emotion.tts');
    return v === 'true';
  });

  const [input, setInput] = useState('');
  const scrollerRef = useRef(null);
  const streamAbortRef = useRef(null);

  const speechSynthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;

  // Auto-scroll
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

  const speakIfEnabled = (reply) => {
    if (!tts || !speechSynthesis || !reply) return;
    try {
      if (speechSynthesis.speaking) speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(reply);
      const voices = speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en'));
      if (preferred) utter.voice = preferred;
      utter.rate = 1.0;
      utter.pitch = 1.0;
      speechSynthesis.speak(utter);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('TTS error', e);
    }
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    ensureConversation();
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
    setInput('');

    const assistantId = 'm_' + Math.random().toString(36).slice(2);
    const assistantMsg = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_MESSAGE', conversationId, message: assistantMsg });

    setSending(true);

    try {
      // Local emotion prediction
      const { label } = await predictEmotion(text);

      // Call API or mock for base assistant reply
      const payload = { messages: messages.concat(userMsg).map((m) => ({ role: m.role, content: m.content })) };
      const res = await postJson('/v1/chat/completions', payload, {
        mock: !process.env.REACT_APP_API_BASE && !process.env.REACT_APP_BACKEND_URL,
      });

      // Stream and tone-adjust progressively
      let accumulated = '';
      streamAbortRef.current = mockStream(
        res.content,
        (chunk) => {
          accumulated += chunk;
          const adjusted = toneAdjust(accumulated, label);
          dispatch({ type: 'UPDATE_MESSAGE', id: assistantId, patch: { content: adjusted } });
        },
        () => {
          setSending(false);
          streamAbortRef.current = null;
          speakIfEnabled(accumulated ? toneAdjust(accumulated, label) : '');
        }
      );
    } catch (e) {
      dispatch({
        type: 'UPDATE_MESSAGE',
        id: assistantId,
        patch: { content: 'Sorry, something went wrong. Please try again.' },
      });
      setSending(false);
      // eslint-disable-next-line no-console
      console.error('emotion chat error', e);
    }
  }, [input, sending, active, state, dispatch, messages, speechSynthesis, tts]);

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
          messages.map((m) => (
            <div key={m.id} className={`message ${m.role === 'user' ? 'user' : 'assistant'}`} role="article">
              <div className="avatar" aria-hidden>{m.role === 'user' ? 'U' : 'A'}</div>
              <div className="bubble">
                <div className="role">{m.role === 'user' ? 'You' : 'Assistant'}</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="composer" style={{ paddingTop: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <label className="subtle" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={tts}
              onChange={(e) => setTts(e.target.checked)}
              aria-label="Enable text-to-speech for assistant replies"
            />
            Speak replies
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            className="textarea"
            rows={3}
            placeholder="Message Ocean Chat..."
            aria-label="Type your message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
