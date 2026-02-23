import React, { createContext, useContext, useState } from 'react';

const FileSystemContext = createContext();

// Mock initial file system
const initialFileSystem = {
    "/": {
        type: "dir",
        contents: ["bin", "sys", "usr"]
    },
    "/bin": {
        type: "dir",
        contents: ["decrypt.exe", "mail.exe"]
    },
    "/sys": {
        type: "dir",
        contents: ["kernel.sys", "trace.log"]
    },
    "/usr": {
        type: "dir",
        contents: ["local"]
    },
    "/usr/local": {
        type: "dir",
        contents: ["readme.txt", "project_echo"]
    },
    "/usr/local/project_echo": {
        type: "dir",
        contents: ["manifest.enc"]
    },

    // Files
    "/bin/decrypt.exe": { type: "exec", content: "DECRYPTOR_APP" },
    "/bin/mail.exe": { type: "exec", content: "MAIL_CLIENT" },
    "/sys/kernel.sys": { type: "file", content: "0x000F00 SYSTEM CORE\nACCESS DENIED" },
    "/sys/trace.log": { type: "file", content: "LAST LOGIN: [REDACTED]\nTRACE: INACTIVE" },
    "/usr/local/readme.txt": { type: "file", content: "Welcome archivist. Your first objective is to locate the ECHO manifest. I left a tool for you." },
    "/usr/local/project_echo/manifest.enc": { type: "file", encrypted: true, content: "[ENCRYPTED_PAYLOAD]" }
};

export function FileSystemProvider({ children }) {
    const [fileSystem, setFileSystem] = useState(initialFileSystem);

    const getDirContents = (path) => {
        return fileSystem[path]?.contents || [];
    };

    const getFile = (path) => {
        return fileSystem[path];
    };

    const updateFile = (path, newProps) => {
        setFileSystem(prev => ({
            ...prev,
            [path]: { ...prev[path], ...newProps }
        }));
    };

    return (
        <FileSystemContext.Provider value={{ fileSystem, getDirContents, getFile, updateFile }}>
            {children}
        </FileSystemContext.Provider>
    );
}

export function useFileSystem() {
    return useContext(FileSystemContext);
}
