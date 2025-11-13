import React from 'react';
import './theme/index.css';
import './App.css'; // keep for potential overrides if needed
import { ChatProvider } from './store/chatStore';
import { Sidebar } from './components/Sidebar.jsx';
import { ChatHeader } from './components/ChatHeader.jsx';
import { ChatView } from './components/ChatView.jsx';

// PUBLIC_INTERFACE
function App() {
  return (
    <ChatProvider>
      <div className="layout">
        <Sidebar />
        <main style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%' }}>
          <ChatHeader />
          <ChatView />
        </main>
      </div>
    </ChatProvider>
  );
}

export default App;
