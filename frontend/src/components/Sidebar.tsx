import React from 'react';
import { Activity, Cpu, Database, DollarSign, BrainCircuit, Zap } from 'lucide-react';
import type { OuroborosStatus } from '../hooks/useOuroboros';
import './Sidebar.css';

interface SidebarProps {
    status: OuroborosStatus | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ status }) => {
    const isOnline = status?.session_active;
    const budgetRatio = status ? status.budget_spent / status.budget_total : 0;

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <div className="brand-logo">
                    <BrainCircuit size={28} className={isOnline ? 'pulse-icon' : ''} />
                </div>
                <div className="brand-text">
                    <h1>Ouroboros</h1>
                    <span className="version">v{status?.version || 'Offline'}</span>
                </div>
            </div>

            <div className="sidebar-section">
                <h2 className="section-title">System CORE</h2>

                <div className="status-card">
                    <div className="status-header">
                        <Activity size={16} className={isOnline ? 'text-emerald' : 'text-rose'} />
                        <span>Status</span>
                    </div>
                    <div className="status-value">
                        <span className={`status-indicator ${isOnline ? 'bg-emerald' : 'bg-rose'}`}></span>
                        {isOnline ? 'NOMINAL' : 'OFFLINE'}
                    </div>
                </div>

                <div className="status-card">
                    <div className="status-header">
                        <Cpu size={16} className="text-cyan" />
                        <span>Active Workers</span>
                    </div>
                    <div className="status-value highlight-cyan">
                        {status?.workers || 0}
                    </div>
                </div>

                <div className="status-card">
                    <div className="status-header">
                        <Database size={16} className="text-indigo" />
                        <span>Task Queue</span>
                    </div>
                    <div className="status-value highlight-indigo">
                        {status?.queue_size || 0}
                    </div>
                </div>

                <div className="status-card budget-card">
                    <div className="status-header">
                        <DollarSign size={16} className={budgetRatio > 0.8 ? 'text-rose' : 'text-emerald'} />
                        <span>API Budget</span>
                    </div>
                    <div className="budget-bar-bg">
                        <div
                            className={`budget-bar-fill ${budgetRatio > 0.8 ? 'bg-rose' : 'bg-emerald'}`}
                            style={{ width: `${Math.min(budgetRatio * 100, 100)}%` }}
                        ></div>
                    </div>
                    <div className="budget-text">
                        ${status?.budget_spent.toFixed(3) || '0.000'} / ${status?.budget_total.toFixed(0) || '10'}
                    </div>
                </div>
            </div>

            <div className="sidebar-footer">
                <div className="footer-item">
                    <Zap size={14} className="text-cyan pulse-icon" />
                    <span>NVIDIA Qwen LLM</span>
                </div>
                <div className="footer-item">
                    <div className="dot thinking-mode"></div>
                    <span>Thinking Mode</span>
                </div>
            </div>
        </aside>
    );
};
