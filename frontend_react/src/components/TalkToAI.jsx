import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat, getActiveConversation } from '../store/chatStore';
import { voiceChat } from '../api/client.js';

/**
 * PUBLIC_INTERFACE
 * TalkToAI provides voice capture (SpeechRecognition) and text-to-speech (SpeechSynthesis).
 * - Displays Start/Stop control with a visual listening indicator.
 * - Sends transcribed text as a user message and plays the assistant response.
 * - Graceful fallback when SpeechRecognition is unavailable (button disabled).
 */
export function TalkToAI() {
  const { state, dispatch } = useChat();
  const active = getActiveConversation(state);

  // Web Speech API availability checks
  const SpeechRecognition = useMemo(() => {
    // Different browsers expose it differently
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);
  const speechSynthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;

  const [listening, setListening] = useState(false);
  const [recognitionError, setRecognitionError] = useState(null);
  const recognizerRef = useRef(null);
  const ttsUtterRef = useRef(null);

  // Feature flag: REACT_APP_FEATURE_FLAGS="feature.voice=true,otherFlag=false"
  const voiceEnabled = useMemo(() => {
    const ff = (process.env.REACT_APP_FEATURE_FLAGS || '').toString();
    if (!ff) return true; // default enabled if unspecified
    const map = new Map(
      ff
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => {
          const [k, v = 'true'] = s.split('=');
          return [k.trim(), v.trim()];
        })
    );
    const val = map.get('feature.voice');
    return val == null ? true : val === 'true';
  }, []);

  const ensureConversation = useCallback(() => {
    if (!active) dispatch({ type: 'NEW_CONVERSATION' });
  }, [active, dispatch]);

  // Helper: Send a user message through the store and request AI reply via /chat endpoint.
  const sendVoiceMessage = useCallback(
    async (text) => {
      if (!text || !text.trim()) return;
      ensureConversation();
      await new Promise((r) => setTimeout(r, 0));
      // Refresh active after potential NEW_CONVERSATION dispatch
      const currentActive = getActiveConversation(state) || getActiveConversation({ ...state, activeId: state.activeId });
      const conversationId = currentActive ? currentActive.id : state.activeId;

      const userMsg = {
        id: 'm_' + Math.random().toString(36).slice(2),
        role: 'user',
        content: text.trim(),
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_MESSAGE', conversationId, message: userMsg });

      // Name the chat if it's still "New chat"
      const conv = getActiveConversation({ ...state, activeId: conversationId });
      if (conv && conv.title === 'New chat') {
        const title = text.slice(0, 40) + (text.length > 40 ? '…' : '');
        dispatch({ type: 'RENAME_CONVERSATION', id: conversationId, title });
      }

      const assistantId = 'm_' + Math.random().toString(36).slice(2);
      const assistantMsg = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_MESSAGE', conversationId, message: assistantMsg });

      try {
        // Call voiceChat which uses env-based API base and falls back to mock if not configured
        const res = await voiceChat(text, {
          mock: !process.env.REACT_APP_API_BASE && !process.env.REACT_APP_BACKEND_URL,
        });
        const reply = (res && (res.content || res.reply || res.message || '')) || '';

        dispatch({ type: 'UPDATE_MESSAGE', id: assistantId, patch: { content: reply } });

        // Speak the assistant reply using speechSynthesis if available
        if (speechSynthesis && reply) {
          try {
            if (speechSynthesis.speaking) {
              speechSynthesis.cancel();
            }
            const utter = new SpeechSynthesisUtterance(reply);
            // Optional: choose a voice with preferable locale, else default
            const voices = speechSynthesis.getVoices();
            const preferred = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en'));
            if (preferred) utter.voice = preferred;
            utter.rate = 1.0;
            utter.pitch = 1.0;
            ttsUtterRef.current = utter;
            speechSynthesis.speak(utter);
          } catch (ttsErr) {
            // Fail silently; UI already shows the text
            // eslint-disable-next-line no-console
            console.warn('TTS error', ttsErr);
          }
        }
      } catch (e) {
        dispatch({
          type: 'UPDATE_MESSAGE',
          id: assistantId,
          patch: { content: 'Sorry, something went wrong with voice request. Please try again.' },
        });
        // eslint-disable-next-line no-console
        console.error('voice chat error', e);
      }
    },
    [dispatch, ensureConversation, speechSynthesis, state]
  );

  // Initialize recognition instance when needed
  const startListening = useCallback(() => {
    setRecognitionError(null);
    if (!SpeechRecognition) {
      setRecognitionError('Speech recognition is not supported in this browser.');
      return;
    }
    try {
      // Stop speaking while capturing audio to reduce echo
      if (speechSynthesis && speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }

      const r = new SpeechRecognition();
      r.lang = 'en-US';
      r.interimResults = true;
      r.continuous = false; // single utterance
      recognizerRef.current = r;

      let finalTranscript = '';

      r.onstart = () => {
        setListening(true);
      };
      r.onerror = (event) => {
        setRecognitionError(event.error || 'Unknown recognition error');
      };
      r.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interim += transcript;
          }
        }
        // Optionally could display interim somewhere; we keep UI minimal
      };
      r.onend = async () => {
        setListening(false);
        // Send only the final transcript
        if (finalTranscript && finalTranscript.trim()) {
          await sendVoiceMessage(finalTranscript);
        }
      };

      r.start();
    } catch (err) {
      setListening(false);
      setRecognitionError('Unable to start speech recognition.');
    }
  }, [SpeechRecognition, sendVoiceMessage, speechSynthesis]);

  const stopListening = useCallback(() => {
    try {
      const r = recognizerRef.current;
      if (r && typeof r.stop === 'function') {
        r.stop();
      }
    } catch {
      // ignore
    } finally {
      setListening(false);
    }
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      try {
        if (recognizerRef.current) {
          recognizerRef.current.stop?.();
          recognizerRef.current.abort?.();
        }
      } catch {
        // ignore
      }
      try {
        if (speechSynthesis && speechSynthesis.speaking) {
          speechSynthesis.cancel();
        }
      } catch {
        // ignore
      }
    };
  }, [speechSynthesis]);

  if (!voiceEnabled) {
    return null;
  }

  const recognitionAvailable = !!SpeechRecognition;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: '6px 0',
      }}
      aria-label="Talk to AI controls"
    >
      <button
        className={`btn ${listening ? 'btn-primary' : ''}`}
        onClick={listening ? stopListening : startListening}
        disabled={!recognitionAvailable}
        aria-pressed={listening}
        aria-label={listening ? 'Stop recording' : 'Start recording'}
        title={recognitionAvailable ? (listening ? 'Stop recording' : 'Start recording') : 'Speech recognition not supported'}
      >
        {listening ? '⏹ Stop' : '🎙️ Talk to AI'}
      </button>

      <div
        aria-live="polite"
        className="subtle"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 20 }}
      >
        {listening ? (
          <>
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: 'var(--secondary)',
                boxShadow: '0 0 0 4px rgba(245,158,11,0.20)',
                animation: 'pulse 1.2s ease-in-out infinite',
              }}
            />
            Listening...
          </>
        ) : (
          <span style={{ color: 'var(--muted-text)' }}>
            {recognitionAvailable ? 'Use your voice to send a message' : 'Voice not supported in this browser'}
          </span>
        )}
      </div>

      {recognitionError && (
        <div role="alert" className="subtle" style={{ color: 'var(--error)' }}>
          {recognitionError}
        </div>
      )}

      <style>
        {`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.75; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}
      </style>
    </div>
  );
}
