function getUserId(user) {
  return String(user?.userId || user?.applicationUserId || '').trim()
}

function NewChatModal({
  isOpen,
  onClose,
  users,
  loadingUsers,
  usersError,
  selectedUserId,
  onSelectUser,
  onCreateChat,
  creating,
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>New Chat</h3>
          <button type="button" className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="user-options" aria-label="Select a user">
          {loadingUsers ? (
            <p className="empty-state">Loading users...</p>
          ) : usersError ? (
            <p className="user-options__error" role="alert">{usersError}</p>
          ) : users.length === 0 ? (
            <p className="empty-state">No other users available</p>
          ) : (
            users.map((user) => {
              const userId = getUserId(user)
              const email = user.email || ''
              const name = user.name || user.displayName || email || userId

              return (
                <button
                  key={userId}
                  type="button"
                  className={`user-option ${selectedUserId === userId ? 'user-option--selected' : ''}`}
                  onClick={() => onSelectUser(userId)}
                  aria-pressed={selectedUserId === userId}
                >
                  <span className="user-option__name">{name}</span>
                  {email && name !== email ? <span className="user-option__detail">{email}</span> : null}
                  <span className="user-option__detail">{userId}</span>
                </button>
              )
            })
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onCreateChat}
            disabled={creating || loadingUsers || Boolean(usersError) || !selectedUserId}
          >
            {creating ? 'Creating...' : 'Create Chat'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default NewChatModal
