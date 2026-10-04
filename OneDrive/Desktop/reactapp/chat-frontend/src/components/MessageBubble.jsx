function MessageBubble({ message, currentUserId }) {
  const currentUserKey = `USER#${currentUserId}`
  const isCurrentUser = String(message.senderId || '').trim() === currentUserKey

  const formattedTime = message.timestamp
    ? new Date(message.timestamp).toLocaleString([], {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'Just now'

  return (
    <div className={`message-row ${isCurrentUser ? 'message-row--mine' : ''}`}>
      <div className={`message-bubble ${isCurrentUser ? 'message-bubble--mine' : ''}`}>
        <div className="message-meta">
          <span>{isCurrentUser ? 'You' : message.senderId || 'Unknown sender'}</span>
          <span>{formattedTime}</span>
        </div>
        <p>{message.message}</p>
      </div>
    </div>
  )
}

export default MessageBubble
