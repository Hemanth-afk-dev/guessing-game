function ChatList({ chats, selectedChatId, onSelectChat, onOpenNewChat, loading }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>My Chats</h2>
      </div>

      {loading ? (
        <p className="empty-state">Loading chats...</p>
      ) : chats.length === 0 ? (
        <p className="empty-state">No chats yet</p>
      ) : (
        <ul className="chat-list">
          {chats.map((chat) => {
            const chatId = chat.chatId || chat.id || chat.PK || 'Unknown'
            const isSelected = selectedChatId === chatId
            const participantCount = Array.isArray(chat.participants)
              ? new Set(chat.participants
                  .map((participant) => String(participant).trim().replace(/^USER#/, ''))
                  .filter(Boolean)).size
              : null
            const isDirectChat = String(chat.chatType || '').toUpperCase() === 'DIRECT'
            const hasInvalidMembership =
              participantCount !== null &&
              (participantCount < 2 || (isDirectChat && participantCount !== 2))

            return (
              <li key={chatId}>
                <button
                  type="button"
                  className={`chat-item ${isSelected ? 'chat-item--selected' : ''}`}
                  onClick={() => onSelectChat(chatId)}
                >
                  <span className="chat-item__title">{chatId}</span>
                  <span className="chat-item__meta">
                    {hasInvalidMembership
                      ? isDirectChat ? 'Invalid DIRECT chat' : 'Invalid chat'
                      : participantCount === null
                        ? 'Members unavailable'
                        : `${participantCount} members`}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <button type="button" className="new-chat-button" onClick={onOpenNewChat}>
        + New Chat
      </button>
    </aside>
  )
}

export default ChatList
