import React, { useState, useEffect, useRef } from 'react';
import {
    Send,
    Terminal,
    Activity,
    Brain,
    DollarSign,
    Layers,
    RefreshCw,
    Trash2,
    ChevronRight,
    Monitor
} from 'lucide-react';

const App = () => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [status, setStatus] = useState({});
    const [logs, setLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('chat');
    const chatEndRef = useRef(null);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                setStatus(data);
            } catch (err) {
                console.error('Failed to fetch status', err);
            }
        };

        const fetchLogs = async () => {
            try {
                const res = await fetch('/api/logs/events');
                const data = await res.json();
                setLogs(data.logs || []);
            } catch (err) {
                console.error('Failed to fetch logs', err);
            }
        };

        fetchStatus();
        fetchLogs();
        const interval = setInterval(() => {
            fetchStatus();
            if (activeTab === 'logs') fetchLogs();
        }, 5000);

        return () => clearInterval(interval);
    }, [activeTab]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, logs]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        const userMessage = { role: 'user', text: inputText, ts: new Date().toISOString() };
        setMessages(prev => [...prev, userMessage]);
        setInputText('');

        try {
            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: inputText }),
            });
        } catch (err) {
            console.error('Failed to send message', err);
        }
    };

    const StatusCard = ({ icon: Icon, label, value, color }) => (
        <div className="glass p-4 rounded-xl flex items-center space-x-3">
            <div className={`p-2 rounded-lg bg-${color}-500/10 text-${color}-400`}>
                <Icon size={20} />
            </div>
            <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">{label}</div>
                <div className="text-lg font-semibold">{value}</div>
            </div>
        </div>
    );

    return (
        <div className="flex h-full w-full bg-[#070912]">
            {/* Sidebar */}
            <div className="w-64 glass border-r flex flex-col">
                <div className="p-6">
                    <h1 className="text-2xl font-bold tracking-tighter gradient-text">OUROBOROS</h1>
                    <p className="text-[10px] text-slate-500 uppercase mt-1">Self-Evolving Cognitive Agent</p>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-slate-400 hover:bg-white/5'}`}
                    >
                        <Send size={18} />
                        <span className="font-medium">Direct Chat</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'logs' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-slate-400 hover:bg-white/5'}`}
                    >
                        <Terminal size={18} />
                        <span className="font-medium">Event Stream</span>
                    </button>
                </nav>

                <div className="p-4 border-t border-white/5">
                    <div className="glass rounded-xl p-3 text-xs space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Session</span>
                            <span className="text-slate-300 font-mono">active</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Version</span>
                            <span className="text-slate-300 font-mono">{status.version || '--'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {/* Header/Stats */}
                <header className="h-20 border-b border-white/5 flex items-center px-8 justify-between">
                    <div className="flex space-x-6">
                        <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${status.workers_alive > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-xs text-slate-400 font-medium">SYSTEM STATUS: {status.workers_alive > 0 ? 'NOMINAL' : 'IDLE'}</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                                <Brain size={14} className="text-primary" />
                                <span className="text-xs text-slate-300">Workers: {status.workers_alive}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <Layers size={14} className="text-primary" />
                                <span className="text-xs text-slate-300">Queue: {status.pending_tasks}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <DollarSign size={14} className="text-green-400" />
                                <span className="text-xs text-slate-300">Spent: ${status.spent_usd?.toFixed(3)} / ${status.total_budget}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex space-x-2">
                        <button className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors" title="Restart System">
                            <RefreshCw size={18} />
                        </button>
                        <button className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors" title="Reset Memory">
                            <Trash2 size={18} />
                        </button>
                    </div>
                </header>

                {/* Viewport */}
                <main className="flex-1 relative overflow-hidden flex flex-col">
                    {activeTab === 'chat' ? (
                        <div className="flex-1 flex flex-col">
                            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                {messages.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center opacity-30 select-none">
                                        <Brain size={64} className="mb-4 text-primary" />
                                        <p className="text-lg font-light tracking-widest uppercase">System Initialization Complete</p>
                                        <p className="text-xs mt-2">Ready for cognitive tasks</p>
                                    </div>
                                )}
                                {messages.map((m, i) => (
                                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] p-4 rounded-2xl ${m.role === 'user' ? 'bg-primary/20 text-text-main border border-primary/30' : 'glass'}`}>
                                            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-tighter">{m.role} • {new Date(m.ts).toLocaleTimeString()}</div>
                                            <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>

                            <div className="p-6 border-t border-white/5 glass">
                                <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto flex space-x-4">
                                    <input
                                        type="text"
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        placeholder="Describe a task or start a conversation..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary/50 text-sm transition-all"
                                    />
                                    <button
                                        type="submit"
                                        className="p-4 bg-primary text-[#070912] rounded-2xl hover:brightness-110 transition-all flex items-center justify-center shadow-lg shadow-primary/20"
                                    >
                                        <Send size={20} />
                                    </button>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col bg-black/40">
                            <div className="p-4 border-b border-white/5 flex justify-between items-center px-8">
                                <h3 className="text-xs font-mono uppercase text-slate-500 tracking-widest flex items-center">
                                    <Monitor size={14} className="mr-2" /> Live System Logs
                                </h3>
                                <div className="flex space-x-4 text-[10px] font-mono">
                                    <span className="text-green-500">● LIVE</span>
                                    <span className="text-slate-400">BUFFER: {logs.length} EVENTS</span>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8 font-mono text-xs">
                                {logs.map((log, i) => (
                                    <div key={i} className="mb-2 group">
                                        <span className="text-slate-600 mr-3">[{new Date(log.ts).toLocaleTimeString()}]</span>
                                        <span className="text-primary mr-3 uppercase">{log.type}</span>
                                        <span className="text-slate-300">{JSON.stringify(log, null, 1)}</span>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;
