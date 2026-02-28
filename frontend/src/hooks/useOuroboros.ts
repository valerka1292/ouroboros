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
            const res = await fetch('/api/status');
            if (!res.ok) throw new Error(`Status HTTP error! status: ${res.status}`);
            const data = await res.json();

            setStatus(data.status);
            setChatHistory(data.chat_tail || []);
            setProgressLogs(data.progress_tail || []);
            setToolLogs(data.tools_tail || []);

            // Basic heuristic for "Thinking" mode:
            // If the last thing is an outgoing progress log that doesn't look like a final answer,
            // or if there are active tools being run and no recent chat message from Ouroboros.
            const lastProgress = data.progress_tail?.[data.progress_tail.length - 1];
            const lastChat = data.chat_tail?.[data.chat_tail.length - 1];

            // Simple logic: If we have recent progress but no matching chat output yet, we might be thinking.
            // (Can refine based on actual Ouroboros event signatures).
            const hasRecentProgress = lastProgress && lastChat && new Date(lastProgress.ts).getTime() > new Date(lastChat.ts).getTime();
            setIsThinking(!!hasRecentProgress);

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
                body: JSON.stringify({ message: text })
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
