import React, { useState, useRef, useEffect } from 'react';
import { useFileSystem } from '../../context/FileSystemContext';
import { useSystem } from '../../context/SystemContext';
import { useWindow } from '../../context/WindowContext';

import DecryptorApp from './Decryptor';

export default function Terminal() {
    const { fileSystem, getDirContents, getFile } = useFileSystem();
    const { setTraceLevel, traceLevel } = useSystem();
    const { openWindow } = useWindow();

    const [history, setHistory] = useState([
        "ECHO_OS v1.0.4 - System Terminal initialized.",
        "Type 'help' for a list of commands."
    ]);
    const [currentPath, setCurrentPath] = useState("/");
    const [input, setInput] = useState("");
    const endOfTerminalRef = useRef(null);

    const scrollToBottom = () => {
        endOfTerminalRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [history]);

    const handleCommand = (cmdStr) => {
        const args = cmdStr.trim().split(" ");
        const cmd = args[0].toLowerCase();

        let output = "";

        switch (cmd) {
            case "help":
                output = "Available commands: help, clear, ls, cd [dir], cat [file], decrypt [file.enc]";
                break;
            case "clear":
                setHistory([]);
                return;
            case "ls":
                const contents = getDirContents(currentPath);
                if (contents.length > 0) {
                    output = contents.join("    ");
                } else {
                    output = "Directory empty.";
                }
                break;
            case "cd":
                if (!args[1]) {
                    output = "cd: missing argument. Usage: cd [dir]";
                } else if (args[1] === "..") {
                    if (currentPath !== "/") {
                        const parts = currentPath.split("/").filter(Boolean);
                        parts.pop();
                        setCurrentPath(parts.length ? "/" + parts.join("/") : "/");
                    }
                } else {
                    const target = args[1];
                    const newPath = currentPath === "/" ? `/${target}` : `${currentPath}/${target}`;
                    if (fileSystem[newPath] && fileSystem[newPath].type === "dir") {
                        setCurrentPath(newPath);
                    } else {
                        output = `cd: ${target}: No such directory`;
                    }
                }
                break;
            case "cat":
                if (!args[1]) {
                    output = "cat: missing argument. Usage: cat [file]";
                } else {
                    const target = args[1];
                    const filePath = currentPath === "/" ? `/${target}` : `${currentPath}/${target}`;
                    const file = getFile(filePath);
                    if (!file) {
                        output = `cat: ${target}: No such file`;
                    } else if (file.type === "dir") {
                        output = `cat: ${target}: Is a directory`;
                    } else if (file.encrypted) {
                        output = "ERROR: File is encrypted. Use decrypt utility.";
                        setTraceLevel(prev => Math.min(prev + 5, 100)); // Increase trace on failure
                    } else {
                        output = file.content;
                    }
                }
                break;
            case "decrypt":
                if (!args[1]) {
                    output = "decrypt: missing argument. Usage: decrypt [file.enc]";
                } else {
                    const target = args[1];
                    const filePath = currentPath === "/" ? `/${target}` : `${currentPath}/${target}`;
                    const file = getFile(filePath);
                    if (!file) {
                        output = `decrypt: ${target}: No such file`;
                    } else if (file.type === "dir") {
                        output = `decrypt: ${target}: Is a directory`;
                    } else if (!file.encrypted) {
                        output = `decrypt: ${target}: File is not encrypted`;
                    } else {
                        output = `Launching decryption utility for ${target}...`;
                        openWindow('decryptor', `DECRYPT::${target}`, () => <DecryptorApp targetPath={filePath} />, { defaultWidth: 400, defaultHeight: 500 });
                    }
                }
                break;
            case "":
                break;
            default:
                output = `Command not found: ${cmd}`;
                setTraceLevel(prev => Math.min(prev + 1, 100)); // Minor trace increase for errors
        }

        setHistory(prev => [...prev, `${currentPath} > ${cmdStr}`, ...(output ? [output] : [])]);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleCommand(input);
            setInput("");
        }
    };

    return (
        <div className="terminal-app h-full flex flex-col font-mono" onClick={() => document.getElementById("terminal-input").focus()}>
            <div className="terminal-history flex-1 overflow-y-auto">
                {history.map((line, i) => (
                    <div key={i} className="terminal-line" style={{ whiteSpace: "pre-wrap" }}>{line}</div>
                ))}
                <div ref={endOfTerminalRef} />
            </div>

            <div className="terminal-input-row flex mt-2 border-t border-theme-dim pt-2">
                <span className="terminal-prompt mr-2">{currentPath} &gt;</span>
                <input
                    id="terminal-input"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                    autoFocus
                    className="bg-transparent border-none text-inherit flex-1 outline-none relative z-10"
                    style={{ fontFamily: 'inherit', fontSize: 'inherit' }}
                />
            </div>
        </div>
    );
}
