import React, { useState } from 'react';
import Desktop from './components/Desktop';
import BootScreen from './components/BootScreen';
import GameOverScreen from './components/GameOverScreen';
import { SystemProvider, useSystem } from './context/SystemContext';
import { WindowProvider } from './context/WindowContext';
import { FileSystemProvider } from './context/FileSystemContext';

function OSContainer() {
  const [isBooted, setIsBooted] = useState(false);
  const { traceLevel } = useSystem();

  const handleRestart = () => {
    window.location.reload();
  };

  if (traceLevel >= 100) {
    return <GameOverScreen onRestart={handleRestart} />;
  }

  return !isBooted ? (
    <BootScreen onComplete={() => setIsBooted(true)} />
  ) : (
    <Desktop />
  );
}

function App() {
  return (
    <SystemProvider>
      <FileSystemProvider>
        <WindowProvider>
          <OSContainer />
        </WindowProvider>
      </FileSystemProvider>
    </SystemProvider>
  );
}

export default App;
