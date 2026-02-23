import React, { useState } from 'react';
import { useFileSystem } from '../../context/FileSystemContext';
import { Folder, FileText, Lock, Box, ArrowUp } from 'lucide-react';

export default function FileExplorer() {
    const { fileSystem, getDirContents, getFile } = useFileSystem();
    const [currentPath, setCurrentPath] = useState("/");

    const contents = getDirContents(currentPath);

    const handleNavigate = (name, type) => {
        if (type === "dir") {
            setCurrentPath(currentPath === "/" ? `/${name}` : `${currentPath}/${name}`);
        } else {
            // In a full implementation, clicking a file might open a viewer or run it.
            // For now, let's just show an alert or a terminal window.
        }
    };

    const handleUp = () => {
        if (currentPath !== "/") {
            const parts = currentPath.split("/").filter(Boolean);
            parts.pop();
            setCurrentPath(parts.length ? "/" + parts.join("/") : "/");
        }
    };

    const renderIcon = (type, encrypted) => {
        if (encrypted) return <Lock size={32} className="warning-text" />;
        if (type === "dir") return <Folder size={32} className="glow-text" />;
        if (type === "exec") return <Box size={32} className="glow-text" />;
        return <FileText size={32} className="glow-text" />;
    };

    return (
        <div className="file-explorer-app h-full flex flex-col">
            <div className="explorer-toolbar border-b border-theme-dim p-2 flex items-center gap-2 mb-2">
                <button
                    onClick={handleUp}
                    disabled={currentPath === "/"}
                    className="p-1 hover:bg-theme-dim disabled:opacity-50"
                >
                    <ArrowUp size={20} />
                </button>
                <div className="path flex-1 border border-theme-dim px-2 py-1 bg-panel-bg-solid">
                    {currentPath}
                </div>
            </div>

            <div className="explorer-grid flex flex-wrap gap-4 p-2 overflow-y-auto">
                {contents.map((name) => {
                    const fullPath = currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
                    const file = getFile(fullPath);
                    return (
                        <div
                            key={name}
                            className="explorer-item flex flex-col items-center justify-center p-2 w-24 text-center cursor-pointer hover:bg-theme-dim border border-transparent hover:border-theme-dim transition-all"
                            onClick={() => handleNavigate(name, file.type)}
                        >
                            {renderIcon(file.type, file.encrypted)}
                            <span className="mt-2 text-sm break-all">{name}</span>
                        </div>
                    );
                })}
                {contents.length === 0 && <div className="text-theme-dim w-full text-center mt-8">Directory empty</div>}
            </div>
        </div>
    );
}
