import React, { useEffect } from 'react';
import { useSound } from '../hooks/useSound';

export default function GameOverScreen({ onRestart }) {
    const { playError } = useSound();

    useEffect(() => {
        // Simulate crashing sounds
        const timer1 = setTimeout(playError, 100);
        const timer2 = setTimeout(playError, 300);
        const timer3 = setTimeout(playError, 500);
        const timer4 = setTimeout(playError, 700);
        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
        };
    }, [playError]);

    return (
        <div className="game-over-screen w-full h-full bg-red-900 text-black flex flex-col items-center justify-center font-mono relative overflow-hidden absolute z-[999999] top-0 left-0">
            <div className="absolute inset-0 pointer-events-none tracking-widest leading-none text-9xl opacity-10 flex flex-wrap break-all overflow-hidden select-none" style={{ textShadow: '0 0 10px black' }}>
                FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL FATAL
            </div>

            <div className="relative z-10 text-center animate-pulse">
                <h1 className="text-6xl font-black mb-4 tracking-tighter" style={{ textShadow: '2px 2px 0px white, -2px -2px 0px white' }}>SYSTEM COMPROMISED</h1>
                <h2 className="text-3xl font-bold mb-8">TRACE LEVEL CRITICAL (100%)</h2>

                <div className="text-xl mb-12 bg-black text-red-500 p-6 inline-block border-4 border-red-500 text-left">
                    <p className="mb-2">{'>'} UNAUTHORIZED ACCESS DETECTED.</p>
                    <p className="mb-2">{'>'} PHYSICAL LOCATION TRIANGULATED.</p>
                    <p className="mb-2">{'>'} LETHAL COUNTERMEASURES DEPLOYED.</p>
                    <p className="font-bold">{'>'} YOUR NEURAL RIG HAS BEEN FRIED.</p>
                </div>

                <div className="mt-8">
                    <button
                        onClick={onRestart}
                        className="bg-black text-red-500 border-2 border-red-500 px-8 py-4 text-2xl font-bold hover:bg-red-500 hover:text-black transition-colors uppercase shadow-lg shadow-black"
                    >
                        [ REBOOT RIG ]
                    </button>
                </div>
            </div>
        </div>
    );
}
