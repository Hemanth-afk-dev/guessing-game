import { useEffect, useMemo, useState } from 'react'
import ChatList from './components/ChatList'
import ChatWindow from './components/ChatWindow'
import NewChatModal from './components/NewChatModal'
import { AWS_CONFIG } from './config/aws.js'
import { createChat, getChatMessages, getUserChats, getUsers } from './services/api.js'
import {
  getAccessToken,
  ensureApplicationUserProfile,
  getApplicationUserId,
  getCurrentUser,
  getCurrentUserId,
  initializeAuthFromCallback,
  isAuthenticated,
  login,
  logout,
} from './services/auth.js'
import {
  connect,
  disconnect,
  getStatus,
  sendMessage,
  subscribe,
  subscribeStatus,
} from './services/websocket.js'
import './App.css'

function normalizeChat(chat) {
  const chatId = chat?.chatId || chat?.id || chat?.PK || 'Unknown'
  const participants = Array.isArray(chat?.participants)
    ? chat.participants
    : Array.isArray(chat?.users)
      ? chat.users
      : []

  return {
    ...chat,
    chatId,
    participants,
  }
}

function normalizeMessage(message) {
  return {
    ...message,
    messageId:
      message?.messageId ||
      message?.id ||
      `${message?.senderId || 'unknown'}-${message?.timestamp || Date.now()}`,
    senderId: message?.senderId || message?.sender || 'UNKNOWN',
    message: message?.message || '',
    timestamp: message?.timestamp || new Date().toISOString(),
  }
}

function getProfileUserId(user) {
  return String(user?.userId || user?.applicationUserId || '').trim()
}

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(() => getApplicationUserId() || '')
  const currentUserKey = currentUserId ? `USER#${currentUserId}` : ''

  const [chats, setChats] = useState([])
  const [selectedChatId, setSelectedChatId] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [error, setError] = useState('')
  const [connectionStatus, setConnectionStatus] = useState(getStatus())
  const [isSending, setIsSending] = useState(false)
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)
  const [availableUsers, setAvailableUsers] = useState([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [isCreatingChat, setIsCreatingChat] = useState(false)

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.chatId === selectedChatId) || null,
    [chats, selectedChatId],
  )

  const getRecipientForSelectedChat = () => {
    if (!selectedChat) {
      return ''
    }

    const participants = Array.isArray(selectedChat.participants)
      ? selectedChat.participants
      : []

    const participantIds = [...new Set(participants.map((participant) =>
      String(participant).trim().replace(/^USER#/, ''),
    ).filter(Boolean))]

    if (participantIds.length !== 2 || !participantIds.includes(currentUserId)) {
      return ''
    }

    return participantIds.find((participantId) => participantId !== currentUserId) || ''
  }

  async function loadChats(userId = currentUserId) {
    setIsLoadingChats(true)
    setError('')

    try {
      const response = await getUserChats(userId)
      const normalizedChats = (response || []).map(normalizeChat)
      setChats(normalizedChats)

      if (normalizedChats.length > 0 && !selectedChatId) {
        setSelectedChatId(normalizedChats[0].chatId)
      }
    } catch (loadError) {
      console.error('Failed to load chats:', loadError)
      setChats([])
      setError(loadError.message || 'Failed to load chats')
    } finally {
      setIsLoadingChats(false)
    }
  }

  async function loadChatMessages(chatId) {
    if (!chatId) {
      return
    }

    setIsLoadingMessages(true)
    setError('')

    try {
      const response = await getChatMessages(chatId)
      const normalizedMessages = (response || []).map(normalizeMessage)
      setMessages(normalizedMessages)
    } catch (loadError) {
      console.error('Failed to load messages:', loadError)
      setMessages([])
      setError(loadError.message || 'Failed to load messages')
    } finally {
      setIsLoadingMessages(false)
    }
  }

  useEffect(() => {
    async function initializeApp() {
      try {
        const callbackHandled = await initializeAuthFromCallback()

        if (!callbackHandled && !isAuthenticated()) {
          await login()
          return
        }

        if (!isAuthenticated()) {
          setError('Authentication required')
          return
        }

        const authenticatedUser = getCurrentUser()
        setCurrentUser(authenticatedUser)
        const applicationUserId = await ensureApplicationUserProfile()
        setCurrentUserId(applicationUserId)

        await loadChats(applicationUserId)
      } catch (authError) {
        console.error('Authentication setup error:', authError)
        setError(authError.message || 'Authentication required')
        setIsLoadingChats(false)
      }
    }

    initializeApp()
  }, [])

  useEffect(() => {
    if (!selectedChatId) {
      return
    }

    loadChatMessages(selectedChatId)
  }, [selectedChatId])

  useEffect(() => {
    if (!isAuthenticated() || !currentUserId) {
      return
    }

    const unsubscribeStatus = subscribeStatus((nextStatus) => setConnectionStatus(nextStatus))
    setConnectionStatus(getStatus())

    const unsubscribeMessage = subscribe((payload) => {
      if (payload?.type !== 'newMessage') {
        return
      }

      const incomingMessage = normalizeMessage(payload)

      setMessages((currentMessages) => {
        const duplicate = currentMessages.some(
          (message) =>
            message.messageId === incomingMessage.messageId ||
            (message.senderId === incomingMessage.senderId &&
              message.message === incomingMessage.message &&
              message.timestamp === incomingMessage.timestamp),
        )

        return duplicate ? currentMessages : [...currentMessages, incomingMessage]
      })
    })

    const connection = connect(currentUserId)

    return () => {
      unsubscribeStatus()
      unsubscribeMessage()
      disconnect(connection)
    }
  }, [currentUserId])

  const handleSelectChat = (chatId) => {
    setSelectedChatId(chatId)
    setError('')
  }

  const handleLogout = () => {
    disconnect()
    logout()
  }

  const handleOpenNewChat = async () => {
    setIsNewChatOpen(true)
    setIsLoadingUsers(true)
    setUsersError('')
    setSelectedUser(null)

    try {
      const response = await getUsers()
      const otherUsers = (response || []).filter((user) => {
        const userId = getProfileUserId(user).replace(/^USER#/, '')
        return userId && userId !== currentUserId
      })
      setAvailableUsers(otherUsers)
    } catch (loadError) {
      console.error('Failed to load users:', loadError)
      setAvailableUsers([])
      setUsersError(loadError.message || 'Failed to load users')
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const handleCloseNewChat = () => {
    setIsNewChatOpen(false)
    setSelectedUser(null)
    setUsersError('')
  }

  const handleSendMessage = () => {
    if (!selectedChatId) {
      setError('Select a chat before sending a message.')
      return
    }

    const trimmedMessage = messageInput.trim()

    if (!trimmedMessage) {
      return
    }

    const recipientId = getRecipientForSelectedChat()

    if (!recipientId) {
      setError('Unable to determine the recipient for this chat. Please create a new chat with a valid participant.')
      return
    }

    if (getStatus() !== 'connected') {
      setError('WebSocket is not connected. Please wait for the connection to finish.')
      return
    }

    setIsSending(true)
    setError('')

    try {
      sendMessage(selectedChatId, currentUserKey, `USER#${recipientId}`, trimmedMessage)
      setMessageInput('')
    } catch (sendError) {
      console.error('Failed to send WebSocket message:', sendError)
      setError(sendError.message || 'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const handleCreateChat = async () => {
    const recipientUserId = getProfileUserId(selectedUser).replace(/^USER#/, '')

    if (!currentUserId || !recipientUserId || recipientUserId === currentUserId) {
      setError('Please select another registered user.')
      return
    }

    setIsCreatingChat(true)
    setError('')

    try {
      const participants = [currentUserKey, `USER#${recipientUserId}`]
      if (new Set(participants.map((participant) => participant.replace(/^USER#/, ''))).size !== 2) {
        throw new Error('A DIRECT chat requires two distinct application users.')
      }

      const createdChat = await createChat(currentUserKey, participants, 'DIRECT')
      const newChatId = createdChat?.chatId || createdChat?.id || createdChat?.chat?.chatId || null

      handleCloseNewChat()
      await loadChats()

      if (newChatId) {
        setSelectedChatId(newChatId)
        await loadChatMessages(newChatId)
      }
    } catch (createError) {
      console.error('Failed to create chat:', createError)
      setError(createError.message || 'Failed to create chat')
    } finally {
      setIsCreatingChat(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__title-section">
          <h1>ChatApplication</h1>
        </div>

        <div className="topbar__meta">
          <span className="meta-label">Current user:</span>
          <strong>{currentUser?.email || getCurrentUserId() || 'Not signed in'}</strong>
        </div>

        <div className="topbar__meta">
          <span className="meta-label">Connection status:</span>
          <span className={`status-indicator status-indicator--${connectionStatus}`}>
            {connectionStatus}
          </span>
        </div>

        <button type="button" className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="app-layout">
        <ChatList
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          onOpenNewChat={handleOpenNewChat}
          loading={isLoadingChats}
        />

        <ChatWindow
          chat={selectedChat}
          messages={messages}
          currentUserId={currentUserId}
          draftMessage={messageInput}
          onDraftChange={setMessageInput}
          onSendMessage={handleSendMessage}
          loading={isLoadingMessages}
          sending={isSending}
          connectionStatus={connectionStatus}
        />
      </div>

      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={handleCloseNewChat}
        users={availableUsers}
        loadingUsers={isLoadingUsers}
        usersError={usersError}
        selectedUserId={getProfileUserId(selectedUser)}
        onSelectUser={(userId) => {
          setSelectedUser(availableUsers.find((user) => getProfileUserId(user) === userId) || null)
        }}
        onCreateChat={handleCreateChat}
        creating={isCreatingChat}
      />
    </div>
  )
}

export default App
