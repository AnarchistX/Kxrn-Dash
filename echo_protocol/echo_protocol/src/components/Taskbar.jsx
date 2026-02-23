import React from 'react';
import { useWindow } from '../context/WindowContext';
import { useSystem } from '../context/SystemContext';
import { Activity, AlertTriangle } from 'lucide-react';

export default function Taskbar() {
    const { windows, focusWindow } = useWindow();
    const { systemTime, traceLevel } = useSystem();

    const timeString = systemTime.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    return (
        <div className="taskbar">
            <div className="taskbar-start">
                <Activity className="glow-text" />
                <span>ECHO_OS v1.0.4</span>
            </div>

            <div className="taskbar-apps">
                {windows.map(w => (
                    <button
                        key={w.id}
                        className={`taskbar-btn ${w.isActive ? 'active' : ''}`}
                        onClick={() => focusWindow(w.id)}
                    >
                        {w.title}
                    </button>
                ))}
            </div>

            <div className="taskbar-system">
                <div className={`trace-meter ${traceLevel > 80 ? 'warning-text glitch' : ''}`}>
                    {traceLevel > 80 && <AlertTriangle size={16} className="inline mr-1" />}
                    TRACE: {traceLevel.toFixed(1)}%
                </div>
                <div className="clock glow-text">
                    {timeString}
                </div>
            </div>
        </div>
    );
}
