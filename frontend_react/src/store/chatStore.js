import React, { createContext, useContext, useMemo, useReducer } from 'react';

// Types (JSDoc for clarity)
/**
 * @typedef {'user'|'assistant'} Role
 */

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {Role} role
 * @property {string} content
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Conversation
 * @property {string} id
 * @property {string} title
 * @property {string} createdAt
 * @property {string[]} messageIds
 */

const initialState = {
  conversations: /** @type {Record<string, Conversation>} */ ({}),
  messages: /** @type {Record<string, Message>} */ ({}),
  activeId: /** @type {string | null} */ (null),
};

/**
 * @typedef {(
 *  | { type: 'NEW_CONVERSATION' }
 *  | { type: 'SET_ACTIVE', id: string }
 *  | { type: 'ADD_MESSAGE', conversationId: string, message: Message }
 *  | { type: 'UPDATE_MESSAGE', id: string, patch: Partial<Message> }
 *  | { type: 'RENAME_CONVERSATION', id: string, title: string }
 * )} Action
 */

function reducer(state, action) {
  switch (action.type) {
    case 'NEW_CONVERSATION': {
      const id = 'c_' + Math.random().toString(36).slice(2);
      const conv = {
        id,
        title: 'New chat',
        createdAt: new Date().toISOString(),
        messageIds: [],
      };
      return {
        ...state,
        conversations: { ...state.conversations, [id]: conv },
        activeId: id,
      };
    }
    case 'SET_ACTIVE': {
      return { ...state, activeId: action.id };
    }
    case 'ADD_MESSAGE': {
      const { conversationId, message } = action;
      const conv = state.conversations[conversationId];
      if (!conv) return state;
      const updatedConv = {
        ...conv,
        messageIds: [...conv.messageIds, message.id],
      };
      return {
        ...state,
        conversations: { ...state.conversations, [conversationId]: updatedConv },
        messages: { ...state.messages, [message.id]: message },
      };
    }
    case 'UPDATE_MESSAGE': {
      const existing = state.messages[action.id];
      if (!existing) return state;
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.id]: { ...existing, ...action.patch },
        },
      };
    }
    case 'RENAME_CONVERSATION': {
      const conv = state.conversations[action.id];
      if (!conv) return state;
      return {
        ...state,
        conversations: {
          ...state.conversations,
          [action.id]: { ...conv, title: action.title },
        },
      };
    }
    default:
      return state;
  }
}

const ChatContext = createContext(null);

// PUBLIC_INTERFACE
export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// PUBLIC_INTERFACE
export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}

// PUBLIC_INTERFACE
export function getActiveConversation(state) {
  return state.activeId ? state.conversations[state.activeId] || null : null;
}

// PUBLIC_INTERFACE
export function getMessagesForConversation(state, conversationId) {
  const conv = state.conversations[conversationId];
  if (!conv) return [];
  return conv.messageIds.map((id) => state.messages[id]).filter(Boolean);
}
