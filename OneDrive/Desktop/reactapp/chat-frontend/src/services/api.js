import { AWS_CONFIG } from '../config/aws.js'
import { getAccessToken } from './auth.js'

async function getJsonResponse(response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function getErrorMessage(response, data) {
  if (response.status === 401) {
    return 'Authentication required. Please sign in again.'
  }

  if (response.status === 403) {
    return 'You do not have permission to access this chat.'
  }

  if (response.status === 400) {
    return data?.message || 'Request could not be processed.'
  }

  if (response.status >= 500) {
    return 'The server is temporarily unavailable. Please try again.'
  }

  return data?.message || 'Something went wrong while contacting the API.'
}

async function request(endpoint, options = {}) {
  const token = getAccessToken()

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${AWS_CONFIG.apiBaseUrl}${endpoint}`, {
    ...options,
    headers,
  })

  const data = await getJsonResponse(response)

  if (!response.ok) {
    throw new Error(getErrorMessage(response, data))
  }

  return data
}

export async function getUserChats(userId) {
  const data = await request(`/users/${userId}/chats`)

  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.items)) {
    return data.items
  }

  if (Array.isArray(data?.chats)) {
    return data.chats
  }

  return []
}

export async function getUsers() {
  const data = await request('/users')

  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.users)) {
    return data.users
  }

  if (Array.isArray(data?.items)) {
    return data.items
  }

  return []
}

export async function getChatMessages(chatId) {
  const data = await request(`/chats/${chatId}/messages`)

  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.items)) {
    return data.items
  }

  if (Array.isArray(data?.messages)) {
    return data.messages
  }

  return []
}

export async function createChat(createdBy, participants, chatType) {
  return request('/chats', {
    method: 'POST',
    body: JSON.stringify({
      createdBy,
      participants,
      chatType,
    }),
  })
}
