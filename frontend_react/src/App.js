import React from 'react';
import './theme/index.css';
import './App.css'; // keep for potential overrides if needed
import { ChatProvider } from './store/chatStore';
import { Sidebar } from './components/Sidebar.jsx';
import { ChatHeader } from './components/ChatHeader.jsx';
import { ChatView } from './components/ChatView.jsx';
import { EmotionChat } from './components/EmotionChat.jsx';

// PUBLIC_INTERFACE
function App() {
  const flags = (process.env.REACT_APP_FEATURE_FLAGS || '').toString();
  const featureMap = new Map(
    flags
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const [k, v = 'true'] = s.split('=');
        return [k.trim(), v.trim()];
      })
  );
  const emotionEnabled = featureMap.get('emotion') === 'true';

  return (
    <ChatProvider>
      <div className="layout">
        <Sidebar />
        <main style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%' }}>
          <ChatHeader />
          {emotionEnabled ? <EmotionChat /> : <ChatView />}
        </main>
      </div>
    </ChatProvider>
  );
}

export default App;
