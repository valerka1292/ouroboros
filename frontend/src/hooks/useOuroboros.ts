import { useState, useEffect, useCallback, useRef } from 'react';

// --- Types ---
export interface OuroborosStatus {
    version: string;
    session_active: boolean;
    budget_total: number;
    budget_spent: number;
    workers: number;
    queue_size: number;
    events: any[]; // System events tail
}

export interface ChatMessage {
    direction: 'in' | 'out';
    text: string;
    ts: string;
}

export interface ProgressLog {
    ts: string;
    text: string;
}

export interface ToolLog {
    timestamp?: string;
    tool?: string;
    args?: any;
    result_preview?: string;
    error?: string;
}

export interface UseOuroborosResult {
    status: OuroborosStatus | null;
    chatHistory: ChatMessage[];
    progressLogs: ProgressLog[];
    toolLogs: ToolLog[];
    isThinking: boolean;
    sendMessage: (text: string) => Promise<void>;
    clearCache: () => Promise<void>;
    fetchState: () => Promise<void>;
    error: string | null;
}

// --- Hook ---
export function useOuroboros(pollingIntervalMs = 2000): UseOuroborosResult {
    const [status, setStatus] = useState<OuroborosStatus | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [progressLogs, setProgressLogs] = useState<ProgressLog[]>([]);
    const [toolLogs, setToolLogs] = useState<ToolLog[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Ref to prevent overlapping fetches
    const isFetching = useRef(false);

    const fetchState = useCallback(async () => {
        if (isFetching.current) return;
        isFetching.current = true;

        try {
            const [statusRes, eventsRes, supervisorRes] = await Promise.all([
                fetch('/api/status'),
                fetch('/api/logs/events'),
                fetch('/api/logs/supervisor')
            ]);

            if (!statusRes.ok) throw new Error(`Status HTTP error! status: ${statusRes.status}`);

            const statusData = await statusRes.json();
            const eventsData = eventsRes.ok ? await eventsRes.json() : { logs: [] };
            const supervisorData = supervisorRes.ok ? await supervisorRes.json() : { logs: [] };

            setStatus({
                version: statusData.version || 'unknown',
                session_active: statusData.consciousness_running ?? true,
                budget_total: statusData.total_budget ?? 0,
                budget_spent: statusData.spent_usd ?? 0,
                workers: statusData.workers_alive ?? 0,
                queue_size: statusData.pending_tasks ?? 0,
                events: eventsData.logs || []
            });

            const events = Array.isArray(eventsData.logs) ? eventsData.logs : [];
            const supervisorLogs = Array.isArray(supervisorData.logs) ? supervisorData.logs : [];

            setChatHistory(
                events
                    .filter((entry: any) => entry?.type === 'owner_message_injected' || entry?.type === 'send_message')
                    .map((entry: any) => ({
                        direction: entry.type === 'send_message' ? 'in' : 'out',
                        text: entry.text || entry.message || '(empty message)',
                        ts: entry.ts || new Date().toISOString()
                    }))
            );

            setProgressLogs(
                events
                    .slice(-100)
                    .map((entry: any) => ({
                        ts: entry.ts || new Date().toISOString(),
                        text: `[${entry.type || 'event'}] ${entry.message || entry.reason || entry.error || ''}`.trim()
                    }))
            );

            setToolLogs(
                supervisorLogs
                    .slice(-100)
                    .map((entry: any) => ({
                        timestamp: entry.ts,
                        tool: entry.type,
                        args: entry,
                        error: entry.error
                    }))
            );

            // Determine "Thinking" mode based on actual backend task queues:
            // If the server has pending or running tasks, Ouroboros is actively working.
            const isWorking = (statusData.pending_tasks || 0) > 0 || (statusData.running_tasks || 0) > 0;
            setIsThinking(isWorking);

            setError(null);
        } catch (err: any) {
            console.error("Fetch Ouroboros state failed:", err);
            // Don't overwrite existing state aggressively on every network blip, just log error.
            setError(err.message || 'Connection lost');
        } finally {
            isFetching.current = false;
        }
    }, []);

    // Poll timer
    useEffect(() => {
        fetchState(); // Initial fetch
        const interval = setInterval(fetchState, pollingIntervalMs);
        return () => clearInterval(interval);
    }, [fetchState, pollingIntervalMs]);

    // Actions
    const sendMessage = async (text: string) => {
        // Optimistic UI update could go here, but since Ouroboros validates and logs, 
        // it's safer to just send and wait for the next poll.
        setIsThinking(true); // Immediate feedback
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (!res.ok) throw new Error('Failed to send message');
            await fetchState(); // Force immediate refresh
        } catch (err: any) {
            console.error(err);
            setError(err.message);
            setIsThinking(false);
        }
    };

    const clearCache = async () => {
        try {
            // Just a placeholder if Ouroboros has a clear endpoint, 
            // or logic to clean up local state if needed.
            alert("Cache cleared (local state only for now)");
        } catch (err) {
            console.error(err);
        }
    };

    return {
        status,
        chatHistory,
        progressLogs,
        toolLogs,
        isThinking,
        sendMessage,
        clearCache,
        fetchState,
        error
    };
}
