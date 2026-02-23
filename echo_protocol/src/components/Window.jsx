import React from 'react';
import { motion } from 'framer-motion';
import { useWindow } from '../context/WindowContext';
import { X, Minus, Square } from 'lucide-react';

export default function Window({ id, title, children, isActive, zIndex, defaultWidth = 600, defaultHeight = 400 }) {
    const { closeWindow, focusWindow } = useWindow();

    return (
        <motion.div
            drag
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
                position: 'absolute',
                width: defaultWidth,
                height: defaultHeight,
                zIndex: zIndex,
                top: '10%',
                left: '20%',
            }}
            className={`os-window ${isActive ? 'active' : 'inactive'}`}
            onPointerDown={() => focusWindow(id)}
        >
            <div className="window-header" onPointerDown={(e) => {
                // Stop propagation here so drag still works but focus window registers
                focusWindow(id);
            }}>
                <div className="window-title">{title}</div>
                <div className="window-controls">
                    <button className="control-btn"><Minus size={14} /></button>
                    <button className="control-btn"><Square size={12} /></button>
                    <button
                        className="control-btn close-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            closeWindow(id);
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            <div className="window-content">
                {children}
            </div>
        </motion.div>
    );
}
