import React, { useRef, useEffect } from 'react';
import { Terminal, Activity, Wrench } from 'lucide-react';
import type { ProgressLog, ToolLog } from '../hooks/useOuroboros';
import './LogViewer.css';

interface LogViewerProps {
    progressLogs: ProgressLog[];
    toolLogs: ToolLog[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ progressLogs, toolLogs }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Combine and sort logs by timestamp
    const allLogs = [
        ...progressLogs.map(l => ({ ...l, type: 'progress' as const })),
        ...toolLogs.map(l => ({ ...l, type: 'tool' as const }))
    ].sort((a: any, b: any) => {
        const tA = (a.ts || a.timestamp || '').toString();
        const tB = (b.ts || b.timestamp || '').toString();
        return tA.localeCompare(tB);
    });

    // Auto-scroll logic
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [allLogs]);

    const renderLogEntry = (log: any, idx: number) => {
        const time = new Date(log.ts || log.timestamp || Date.now()).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (log.type === 'progress') {
            return (
                <div key={`p-${idx}`} className="log-entry progress-log">
                    <span className="log-time">[{time}]</span>
                    <Activity size={12} className="log-icon text-cyan" />
                    <span className="log-text">{log.text}</span>
                </div>
            );
        }

        if (log.type === 'tool') {
            const toolName = log.tool || log.tool_name || 'unknown_tool';
            const statusClass = log.error ? 'text-rose' : (log.result_preview ? 'text-emerald' : 'text-indigo');
            const isError = !!log.error;

            return (
                <div key={`t-${idx}`} className={`log-entry tool-log ${isError ? 'log-error' : ''}`}>
                    <span className="log-time">[{time}]</span>
                    <Wrench size={12} className={`log-icon ${statusClass}`} />
                    <span className="log-tool-name">EXEC: {toolName}</span>
                    <span className="log-text">
                        {log.args ? JSON.stringify(log.args).substring(0, 100) : ''}
                        {log.args && JSON.stringify(log.args).length > 100 ? '...' : ''}
                    </span>
                    {isError && <div className="log-error-text">ERROR: {log.error}</div>}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="log-viewer">
            <div className="log-header">
                <Terminal size={14} className="text-cyan" />
                <span>System Terminal</span>
                <div className="header-decoration"></div>
            </div>
            <div className="log-content" ref={scrollRef}>
                {allLogs.length === 0 ? (
                    <div className="log-empty">System awaiting initialization...</div>
                ) : (
                    allLogs.slice(-100).map((log, idx) => renderLogEntry(log, idx))
                )}
            </div>
        </div>
    );
};
