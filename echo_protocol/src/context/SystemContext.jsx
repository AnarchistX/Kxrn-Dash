import React, { createContext, useContext, useState, useEffect } from 'react';

const SystemContext = createContext();

export function SystemProvider({ children }) {
  const [traceLevel, setTraceLevel] = useState(0); // 0 to 100
  const [systemTime, setSystemTime] = useState(new Date());
  const [activeObjective, setActiveObjective] = useState("Awaiting instructions...");
  const [isGlitching, setIsGlitching] = useState(false);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setSystemTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Glitch effect based on trace level
  useEffect(() => {
    if (traceLevel > 80) {
      const glitchTimer = setInterval(() => {
        setIsGlitching(true);
        setTimeout(() => setIsGlitching(false), 200 + Math.random() * 300);
      }, 2000 - (traceLevel * 15)); // Glitches more frequently as trace goes up
      return () => clearInterval(glitchTimer);
    } else {
      setIsGlitching(false);
    }
  }, [traceLevel]);

  const value = {
    traceLevel,
    setTraceLevel,
    systemTime,
    activeObjective,
    setActiveObjective,
    isGlitching,
  };

  return (
    <SystemContext.Provider value={value}>
      <div className={`h-full w-full ${isGlitching ? 'glitch' : ''}`}>
        {children}
        <div className="crt-overlay" />
      </div>
    </SystemContext.Provider>
  );
}

export function useSystem() {
  return useContext(SystemContext);
}
