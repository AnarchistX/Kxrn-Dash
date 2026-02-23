import React, { useState } from 'react';
import { Mail as MailIcon } from 'lucide-react';

const mockEmails = [
    {
        id: 1,
        sender: "unknown@proxy.net",
        subject: "INITIALIZATION",
        date: "TODAY 04:00",
        read: false,
        body: "Archivist.\n\nIf you are reading this, the connection held. Welcome to ECHO_OS.\n\nYour target is the project_echo directory. It contains a highly classified manifest detailing the corporation's true purpose before the collapse.\n\nUse the terminal. Find the encrypted file. The decrypt utility is in /bin.\n\nDo not let the Trace meter reach 100%, or the automated countermeasures will fry your rig.\n\nGood luck."
    },
    {
        id: 2,
        sender: "sysadmin_auto",
        subject: "WARNING: UNAUTHORIZED ACCESS",
        date: "TODAY 04:01",
        read: true,
        body: "Automated alert.\n\nUnauthorized login detected from external proxy. Trace protocols engaged. \n\nAll external connections will be severed upon trace completion."
    }
];

export default function Mail() {
    const [emails, setEmails] = useState(mockEmails);
    const [selectedEmail, setSelectedEmail] = useState(null);

    const handleSelect = (email) => {
        setSelectedEmail(email);
        if (!email.read) {
            setEmails(emails.map(e => e.id === email.id ? { ...e, read: true } : e));
        }
    };

    return (
        <div className="mail-app h-full flex font-sans text-sm"> {/* Using sans for easier reading of long text */}
            {/* Sidebar / Inbox */}
            <div className="w-1/3 border-r border-theme-dim flex flex-col">
                <div className="w-full bg-theme-dim p-2 font-bold font-mono text-center flex items-center justify-center gap-2">
                    <MailIcon size={16} /> INBOX
                </div>
                <div className="flex-1 overflow-y-auto">
                    {emails.map(email => (
                        <div
                            key={email.id}
                            className={`p-3 border-b border-theme-dim cursor-pointer transition-colors ${selectedEmail?.id === email.id ? 'bg-theme text-bg-color' : 'hover:bg-theme-dim/50'}`}
                            onClick={() => handleSelect(email)}
                        >
                            <div className={`font-bold ${!email.read && selectedEmail?.id !== email.id ? 'glow-text' : ''}`}>
                                {email.sender}
                            </div>
                            <div className="truncate text-xs opacity-80">{email.subject}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reader area */}
            <div className="w-2/3 p-4 bg-panel-bg-solid relative overflow-y-auto">
                {selectedEmail ? (
                    <div>
                        <div className="border-b border-theme-dim pb-4 mb-4">
                            <div className="text-xl font-bold font-mono mb-1">{selectedEmail.subject}</div>
                            <div className="flex justify-between text-xs font-mono opacity-80">
                                <span>From: {selectedEmail.sender}</span>
                                <span>{selectedEmail.date}</span>
                            </div>
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed font-mono">
                            {selectedEmail.body}
                        </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-50 font-mono">
                        SELECT A MESSAGE
                    </div>
                )}
            </div>
        </div>
    );
}
