import React, { useState, useEffect } from 'react';
import { useSound } from '../hooks/useSound';

const bootSequence = [
    "ECHO_PROTOCOL INITIATED...",
    "ESTABLISHING SECURE CONNECTION...",
    "WARNING: AUTOMATED COUNTERMEASURES DETECTED.",
    " ",
    "MISSION PARAMETERS:",
    "1. Access the terminal.",
    "2. Navigate to /usr/local/project_echo.",
    "3. Run the decryption utility on manifest.enc.",
    " ",
    "DECRYPTION PROTOCOL [HEX-BREAKER v2.1]:",
    "- Input a 4-character hex sequence (0-9, A-F).",
    "- EXACT: Correct character in correct position.",
    "- PRT: Correct character in wrong position.",
    " ",
    "CRITICAL WARNING:",
    "- Failed commands and partial decryption attempts increase TRACE LEVEL.",
    "- If TRACE reaches 100%, the connection will be severed, and your rig will be fried.",
    " ",
    "READY FOR UPLINK."
];

export default function BootScreen({ onComplete }) {
    const [lines, setLines] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showPrompt, setShowPrompt] = useState(false);
    const { playTyping } = useSound();

    useEffect(() => {
        if (currentIndex < bootSequence.length) {
            const timer = setTimeout(() => {
                setLines(prev => [...prev, bootSequence[currentIndex]]);
                setCurrentIndex(prev => prev + 1);
                if (bootSequence[currentIndex].trim() !== "") {
                    playTyping();
                }
            }, 500); // Wait 0.5s between lines
            return () => clearTimeout(timer);
        } else {
            setTimeout(() => setShowPrompt(true), 1000);
        }
    }, [currentIndex, playTyping]);

    useEffect(() => {
        const handleKeyDown = () => {
            // If pressing a key while booting, skip it all or just start if done
            if (showPrompt) {
                onComplete();
            } else {
                // Skip typing animation
                setLines([...bootSequence]);
                setCurrentIndex(bootSequence.length);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showPrompt, onComplete]);

    return (
        <div className="boot-screen h-full w-full bg-bg-color text-theme p-8 font-mono flex flex-col justify-start absolute z-[99999] top-0 left-0">
            <div className="flex-1 overflow-y-auto">
                {lines.map((line, i) => (
                    <div key={i} className={`mb-1 ${line.includes("WARNING") ? "warning-text animate-pulse" : ""}`}>
                        {line}
                    </div>
                ))}
            </div>

            {showPrompt && (
                <div className="mt-8 text-center text-xl animate-pulse cursor-pointer p-4 border border-theme hover:bg-theme-dim transition-colors"
                    onClick={onComplete}>
                    [ PRESS ANY KEY OR CLICK TO INITIALIZE ]
                </div>
            )}
        </div>
    );
}
