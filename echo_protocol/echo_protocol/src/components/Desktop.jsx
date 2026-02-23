import React from 'react';
import { useWindow } from '../context/WindowContext';
import { useSystem } from '../context/SystemContext';
import { Terminal as TerminalIcon, Folder, Mail } from 'lucide-react';
import Window from './Window';
import Taskbar from './Taskbar';

import TerminalApp from './apps/Terminal';
import FileExplorerApp from './apps/FileExplorer';
import MailApp from './apps/Mail';

const DesktopIcon = ({ name, icon: Icon, onClick }) => (
    <div
        className="desktop-icon text-theme hover:bg-theme-dim border border-transparent hover:border-theme-dim p-2 flex flex-col items-center justify-center cursor-pointer transition-colors"
        onClick={onClick}
    >
        <Icon size={48} className="glow-text mb-1" />
        <span className="text-xs font-bold bg-bg-color px-1">{name}</span>
    </div>
);

export default function Desktop() {
    const { windows, openWindow } = useWindow();
    const { isGlitching } = useSystem();

    const handleOpenTerminal = () => {
        openWindow('terminal', 'ECHO_OS::Terminal', TerminalApp, { defaultWidth: 600, defaultHeight: 400 });
    };

    const handleOpenFiles = () => {
        openWindow('files', 'File_Explorer', FileExplorerApp, { defaultWidth: 500, defaultHeight: 400 });
    };

    const handleOpenMail = () => {
        openWindow('mail', 'Messages', MailApp, { defaultWidth: 700, defaultHeight: 500 });
    };

    return (
        <div className="desktop-container absolute inset-0 w-full h-full overflow-hidden">
            <div className="h-full w-full flex flex-col items-start p-6 gap-6 relative z-10">
                <DesktopIcon name="Terminal" icon={TerminalIcon} onClick={handleOpenTerminal} />
                <DesktopIcon name="FileSystem" icon={Folder} onClick={handleOpenFiles} />
                <DesktopIcon name="Messages" icon={Mail} onClick={handleOpenMail} />
            </div>

            {windows.map(w => (
                <Window
                    key={w.id}
                    id={w.id}
                    title={w.title}
                    isActive={w.isActive}
                    zIndex={w.zIndex}
                    defaultWidth={w.defaultWidth}
                    defaultHeight={w.defaultHeight}
                >
                    <w.Component />
                </Window>
            ))}

            <Taskbar />
        </div>
    );
}
