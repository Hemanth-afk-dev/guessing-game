import { AWS_CONFIG } from '../config/aws.js'

let socket = null
let listeners = []
let statusListeners = []

function notifyStatus(nextStatus) {
  statusListeners.forEach((listener) => listener(nextStatus))
}

export function subscribe(listener) {
  listeners.push(listener)

  return () => {
    listeners = listeners.filter((item) => item !== listener)
  }
}

export function subscribeStatus(listener) {
  statusListeners.push(listener)

  return () => {
    statusListeners = statusListeners.filter((item) => item !== listener)
  }
}

export function getStatus() {
  if (!socket) {
    return 'disconnected'
  }

  if (socket.readyState === WebSocket.CONNECTING) {
    return 'connecting'
  }

  return socket.readyState === WebSocket.OPEN ? 'connected' : 'disconnected'
}

export function connect(userId) {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return socket
  }

  notifyStatus('connecting')

  const connection = new WebSocket(
    `${AWS_CONFIG.websocketUrl}?userId=${encodeURIComponent(userId)}`,
  )
  socket = connection

  connection.onopen = () => {
    if (socket !== connection) {
      return
    }

    notifyStatus('connected')
  }

  connection.onclose = () => {
    if (socket !== connection) {
      return
    }

    notifyStatus('disconnected')
    socket = null
  }

  connection.onerror = () => {
    if (socket !== connection) {
      return
    }

    notifyStatus('disconnected')
  }

  connection.onmessage = (event) => {
    if (socket !== connection) {
      return
    }

    try {
      const data = JSON.parse(event.data)

      listeners.forEach((listener) => listener(data))
    } catch (error) {
      console.error('Failed to parse WebSocket payload:', error)
    }
  }

  return connection
}

export function disconnect(expectedSocket) {
  if (expectedSocket && socket !== expectedSocket) {
    return
  }

  if (socket) {
    const activeSocket = socket
    socket = null
    notifyStatus('disconnected')
    activeSocket.close()
  }
}

export function sendMessage(chatId, senderId, recipientId, message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    if (socket?.readyState === WebSocket.CLOSED) {
      socket = null
    }
    notifyStatus(socket?.readyState === WebSocket.CONNECTING ? 'connecting' : 'disconnected')
    throw new Error('WebSocket is not connected.')
  }

  const payload = {
    action: 'sendMessage',
    chatId,
    senderId,
    recipientId,
    message,
  }

  socket.send(JSON.stringify(payload))
}
