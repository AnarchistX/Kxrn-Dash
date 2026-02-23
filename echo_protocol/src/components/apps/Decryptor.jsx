import React, { useState, useEffect } from 'react';
import { useFileSystem } from '../../context/FileSystemContext';
import { useSystem } from '../../context/SystemContext';
import { useWindow } from '../../context/WindowContext';
import { Unlock, ShieldAlert } from 'lucide-react';
import { useSound } from '../../hooks/useSound';

export default function Decryptor({ targetPath }) {
    const { getFile, updateFile } = useFileSystem();
    const { setTraceLevel } = useSystem();
    const { closeWindow } = useWindow();
    const { playTyping, playSuccess, playError } = useSound();

    const file = targetPath ? getFile(targetPath) : null;

    // Game State
    const [targetCode, setTargetCode] = useState([]);
    const [currentGuess, setCurrentGuess] = useState("");
    const [attempts, setAttempts] = useState([]);
    const [status, setStatus] = useState("AWAITING_INPUT"); // AWAITING_INPUT, SUCCESS, FAILED
    const [maxAttempts] = useState(6);

    // Initialize Puzzle (Mastermind style logic, but with hex chars)
    useEffect(() => {
        if (file && file.encrypted) {
            const chars = "0123456789ABCDEF";
            let code = "";
            for (let i = 0; i < 4; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            setTargetCode(code.split(""));
        }
    }, [file]);

    if (!file) {
        return <div className="p-4 warning-text">ERROR: NO TARGET SPECIFIED. LAUNCH VIA TERMINAL.</div>;
    }

    if (!file.encrypted) {
        return <div className="p-4 glow-text">FILE IS NOT ENCRYPTED.</div>;
    }

    const handleInputChange = (e) => {
        setCurrentGuess(e.target.value.substring(0, 4));
        playTyping();
    };

    const handleGuess = (e) => {
        e.preventDefault();
        if (currentGuess.length !== 4 || status !== "AWAITING_INPUT") return;

        const guessArr = currentGuess.toUpperCase().split("");
        let exactMatches = 0;
        let partialMatches = 0;

        // Deep copy to mark used characters
        let tCode = [...targetCode];
        let gCode = [...guessArr];

        // Check exacts
        for (let i = 0; i < 4; i++) {
            if (gCode[i] === tCode[i]) {
                exactMatches++;
                tCode[i] = null;
                gCode[i] = null;
            }
        }

        // Check partials
        for (let i = 0; i < 4; i++) {
            if (gCode[i] !== null && tCode.includes(gCode[i])) {
                partialMatches++;
                tCode[tCode.indexOf(gCode[i])] = null;
            }
        }

        const newAttempt = { guess: currentGuess.toUpperCase(), exactMatches, partialMatches };
        const newAttempts = [...attempts, newAttempt];
        setAttempts(newAttempts);
        setCurrentGuess("");

        if (exactMatches === 4) {
            setStatus("SUCCESS");
            playSuccess();
            setTimeout(() => {
                updateFile(targetPath, {
                    encrypted: false,
                    content: "ECHO MANIFEST\n\nPROJECT ECHO WAS NEVER ABOUT DATA STORAGE...\nIT WAS ABOUT MIND UPLOADING.\n\nTHEY DIDN'T DIE. THEY ARE IN THE SERVER."
                });
                closeWindow("decryptor");
            }, 3000);
        } else if (newAttempts.length >= maxAttempts) {
            setStatus("FAILED");
            playError();
            setTraceLevel(prev => Math.min(prev + 25, 100)); // Huge trace penalty for failing
        } else {
            playTyping();
            setTraceLevel(prev => Math.min(prev + 5, 100)); // Small trace penalty per guess
        }
    };

    return (
        <div className="decryptor-app h-full flex flex-col items-center justify-center p-4 font-mono">
            <div className="text-xl mb-4 text-center">
                <Unlock className="inline mr-2 glow-text mb-1" />
                DECRYPT: {targetPath.split('/').pop()}
            </div>

            <div className="w-full max-w-sm bg-bg-color border border-theme-dim p-4">
                <div className="text-center mb-4 opacity-80 text-xs">
                    CRACK THE 4-DIGIT HEX KEY [0-9, A-F]<br />
                    MATCHES = CORRECT POS, PARTIALS = WRONG POS
                </div>

                <div className="attempts-board flex flex-col gap-2 mb-4 h-48 overflow-y-auto">
                    {attempts.map((att, i) => (
                        <div key={i} className="flex justify-between items-center border-b border-theme-dim pb-1">
                            <span className="tracking-widest font-bold text-lg">{att.guess}</span>
                            <span className="text-xs">
                                EXACT: <span className="glow-text">{att.exactMatches}</span> |
                                PRT: <span className="warning-text">{att.partialMatches}</span>
                            </span>
                        </div>
                    ))}
                    {[...Array(maxAttempts - attempts.length)].map((_, i) => (
                        <div key={`empty-${i}`} className="flex justify-between items-center border-b border-theme-dim pb-1 opacity-30">
                            <span className="tracking-widest font-bold text-lg">----</span>
                        </div>
                    ))}
                </div>

                {status === "AWAITING_INPUT" && (
                    <form onSubmit={handleGuess} className="flex gap-2">
                        <input
                            type="text"
                            value={currentGuess}
                            onChange={handleInputChange}
                            className="bg-transparent border border-theme text-theme text-center text-xl tracking-widest w-full outline-none focus:glow-text"
                            placeholder="____"
                            autoFocus
                        />
                        <button type="submit" className="border border-theme px-4 hover:bg-theme-dim">EXE</button>
                    </form>
                )}

                {status === "SUCCESS" && (
                    <div className="text-center text-xl font-bold animate-pulse">
                        DECRYPTION SUCCESSFUL.<br />UNLOCKING...
                    </div>
                )}

                {status === "FAILED" && (
                    <div className="text-center text-xl font-bold warning-text animate-pulse">
                        <ShieldAlert className="inline mr-2 mb-1" />
                        ACCESS DENIED. TRACE SPIKE DETECTED.
                    </div>
                )}
            </div>
        </div>
    );
}
