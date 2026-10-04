import MessageBubble from './MessageBubble'
import MessageInput from './MessageInput'

function ChatWindow({
  chat,
  messages,
  currentUserId,
  draftMessage,
  onDraftChange,
  onSendMessage,
  loading,
  sending,
  connectionStatus,
}) {
  const chatTitle = chat ? `Chat with ${chat.chatId || 'selected chat'}` : 'Select a chat'

  return (
    <main className="chat-window">
      <header className="chat-header">
        <div>
          <h2>{chatTitle}</h2>
          {chat ? <p className="chat-subtitle">Connection status: {connectionStatus}</p> : null}
        </div>
        <div className={`status-pill status-pill--${connectionStatus}`}>
          {connectionStatus}
        </div>
      </header>

      <div className="messages-panel">
        {loading ? (
          <p className="empty-state">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="empty-state">No messages yet</p>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.messageId || `${message.senderId}-${message.timestamp}-${message.message}`} message={message} currentUserId={currentUserId} />
          ))
        )}
      </div>

      <MessageInput
        value={draftMessage}
        onChange={onDraftChange}
        onSend={onSendMessage}
        disabled={!chat || sending}
        sending={sending}
      />
    </main>
  )
}

export default ChatWindow
