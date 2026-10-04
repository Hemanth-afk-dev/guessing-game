function MessageInput({ value, onChange, onSend, disabled, sending }) {
  return (
    <div className="composer">
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && value.trim() && !disabled) {
            onSend()
          }
        }}
        placeholder="Type a message..."
        disabled={disabled}
      />
      <button type="button" onClick={onSend} disabled={disabled || !value.trim()}>
        {sending ? 'Sending...' : 'Send'}
      </button>
    </div>
  )
}

export default MessageInput
