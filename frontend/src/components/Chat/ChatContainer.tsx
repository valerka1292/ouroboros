import React, { useRef, useEffect } from 'react';
import { SendHorizontal, BrainCircuit } from 'lucide-react';
import type { ChatMessage, ProgressLog } from '../../hooks/useOuroboros';
import './Chat.css';

interface ChatMessageProps {
    message: ChatMessage;
}

const MessageBubble: React.FC<ChatMessageProps> = ({ message }) => {
    const isAgent = message.direction === 'in' || message.direction.toLowerCase() === 'incoming';

    // Format the timestamp nicely
    const time = new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className={`message-wrapper ${isAgent ? 'message-agent' : 'message-user'}`}>
            {isAgent && (
                <div className="message-avatar agent-avatar">
                    <BrainCircuit size={20} />
                </div>
            )}
            <div className="message-content">
                <div className="message-header">
                    <span className="sender-name">{isAgent ? 'Ouroboros' : 'You'}</span>
                    <span className="timestamp">{time}</span>
                </div>
                <div className="message-text">{message.text}</div>
            </div>
            {!isAgent && (
                <div className="message-avatar user-avatar">
                    <div className="user-icon" />
                </div>
            )}
        </div>
    );
};

interface ChatContainerProps {
    chatHistory: ChatMessage[];
    progressLogs: ProgressLog[];
    isThinking: boolean;
    onSendMessage: (text: string) => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
    chatHistory,
    progressLogs,
    isThinking,
    onSendMessage
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatHistory, progressLogs, isThinking]);

    const handleSend = () => {
        if (inputRef.current && inputRef.current.value.trim() !== '') {
            onSendMessage(inputRef.current.value.trim());
            inputRef.current.value = '';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    // The latest progress log might be useful to show while thinking
    const latestProgress = progressLogs.length > 0 ? progressLogs[progressLogs.length - 1] : null;

    return (
        <div className="chat-container">
            <div className="chat-messages" ref={scrollRef}>
                {chatHistory.length === 0 && (
                    <div className="empty-state">
                        <BrainCircuit size={48} className="empty-icon pulse" />
                        <p>I am Ouroboros. How can we evolve today?</p>
                    </div>
                )}

                {chatHistory.map((msg, idx) => (
                    <MessageBubble key={idx} message={msg} />
                ))}

                {isThinking && (
                    <div className="thinking-indicator">
                        <BrainCircuit className="pulse-icon" size={24} />
                        <span className="thinking-text">
                            {latestProgress ? latestProgress.text.substring(0, 60) + '...' : 'Processing...'}
                        </span>
                        <div className="dots">
                            <span className="dot"></span><span className="dot"></span><span className="dot"></span>
                        </div>
                    </div>
                )}
            </div>

            <div className="chat-input-area">
                <div className="input-wrapper">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Send a directive to Ouroboros..."
                        onKeyDown={handleKeyDown}
                        disabled={isThinking}
                    />
                    <button
                        className="send-button"
                        onClick={handleSend}
                        disabled={isThinking}
                        aria-label="Send"
                    >
                        <SendHorizontal size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};
