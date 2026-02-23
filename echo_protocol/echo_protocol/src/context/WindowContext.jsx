import React, { createContext, useContext, useState } from 'react';

const WindowContext = createContext();

export function WindowProvider({ children }) {
    const [windows, setWindows] = useState([]); // { id, title, component, isActive, ...props }
    const [highZIndex, setHighZIndex] = useState(10);

    const openWindow = (id, title, Component, extraProps = {}) => {
        setWindows(prev => {
            // If already open, just focus it
            if (prev.find(w => w.id === id)) {
                return prev.map(w => w.id === id ? { ...w, isActive: true, zIndex: highZIndex + 1 } : { ...w, isActive: false });
            }

            const newZ = highZIndex + 1;
            setHighZIndex(newZ);

            return [...prev.map(w => ({ ...w, isActive: false })), {
                id,
                title,
                Component,
                isActive: true,
                zIndex: newZ,
                ...extraProps
            }];
        });
    };

    const closeWindow = (id) => {
        setWindows(prev => prev.filter(w => w.id !== id));
    };

    const focusWindow = (id) => {
        setWindows(prev => {
            const newZ = highZIndex + 1;
            setHighZIndex(newZ);
            return prev.map(w => w.id === id
                ? { ...w, isActive: true, zIndex: newZ }
                : { ...w, isActive: false }
            );
        });
    };

    return (
        <WindowContext.Provider value={{ windows, openWindow, closeWindow, focusWindow }}>
            {children}
        </WindowContext.Provider>
    );
}

export function useWindow() {
    return useContext(WindowContext);
}
