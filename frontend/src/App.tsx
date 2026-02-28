import { useOuroboros } from './hooks/useOuroboros';
import { Sidebar } from './components/Sidebar';
import { ChatContainer } from './components/Chat/ChatContainer';
import { LogViewer } from './components/LogViewer';
import { AlertCircle } from 'lucide-react';

function App() {
  const {
    status,
    chatHistory,
    progressLogs,
    toolLogs,
    isThinking,
    sendMessage,
    error
  } = useOuroboros(1500);

  return (
    <div className="layout-master">
      {error && (
        <div className="global-error">
          <AlertCircle size={16} />
          <span>Connection Error: {error} - Retrying...</span>
        </div>
      )}

      <div className="layout-horizontal">
        <Sidebar status={status} />

        <main className="layout-main">
          <div className="layout-chat">
            <ChatContainer
              chatHistory={chatHistory}
              progressLogs={progressLogs}
              isThinking={isThinking}
              onSendMessage={sendMessage}
            />
          </div>
          <div className="layout-logs">
            <LogViewer progressLogs={progressLogs} toolLogs={toolLogs} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
