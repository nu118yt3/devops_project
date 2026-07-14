import React, { useEffect } from 'react';

const LoginBackground: React.FC = () => {
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            requestAnimationFrame(() => {
                const x = e.clientX / window.innerWidth;
                const y = e.clientY / window.innerHeight;
                document.documentElement.style.setProperty('--mouse-x', x.toString());
                document.documentElement.style.setProperty('--mouse-y', y.toString());
            });
        };

        document.addEventListener('mousemove', handleMouseMove);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Interactive Layer 1: Blueprint Grid */}
            <div className="absolute inset-0 blueprint-grid opacity-70 dark:opacity-50 interactive-layer-1"></div>

            {/* Interactive Layer 2: Scan Lines and Construction Blocks */}
            <div className="absolute inset-0 overflow-hidden interactive-layer-2">
                <div className="scan-line-h animate-scan-h" style={{ top: '10%' }}></div>
                <div className="scan-line-h animate-scan-h delay-4000" style={{ animationDuration: '25s', top: '60%' }}></div>
                <div className="scan-line-v animate-scan-v delay-2000" style={{ left: '20%' }}></div>
                <div className="scan-line-v animate-scan-v delay-5000" style={{ animationDuration: '18s', left: '80%' }}></div>

                <div className="construction-block w-[50px] h-[50px] top-[20%] left-[15%] animate-construct delay-1000"></div>
                <div className="construction-block w-[100px] h-[50px] top-[60%] right-[10%] animate-construct delay-3000"></div>
                <div className="construction-block w-[50px] h-[150px] bottom-[15%] left-[25%] animate-construct delay-2000"></div>
                <div className="construction-block w-[50px] h-[50px] top-[30%] right-[25%] animate-construct delay-4000"></div>
                <div className="construction-block w-[150px] h-[50px] top-[15%] left-[40%] animate-construct delay-5000"></div>
                <div className="construction-block w-[50px] h-[50px] bottom-[40%] right-[40%] animate-construct delay-1000"></div>
            </div>

            {/* Interactive Layer 3: Blobs */}
            <div className="absolute inset-0 interactive-layer-3 overflow-hidden">
                <div className="absolute top-0 -left-20 w-96 h-96 bg-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob dark:mix-blend-screen dark:bg-primary/10"></div>
                <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-emerald-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob delay-2000 dark:mix-blend-screen dark:bg-emerald-600/10"></div>
            </div>
        </div>
    );
};

export default LoginBackground;
