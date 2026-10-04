import { AWS_CONFIG } from '../config/aws.js'

const AUTH_SESSION_KEY = 'chatapp-cognito-auth'
const PKCE_VERIFIER_KEY = 'chatapp-cognito-pkce'
const OAUTH_STATE_KEY = 'chatapp-cognito-state'
let callbackCode = null
let callbackPromise = null
let loginRedirectStarted = false

function base64UrlEncode(value) {
  return btoa(String.fromCharCode(...new Uint8Array(value)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await window.crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(digest)
}

function generateRandomString(length = 32) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const array = new Uint8Array(length)
  window.crypto.getRandomValues(array)

  return Array.from(array, (value) => possible[value % possible.length]).join('')
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    const decoded = atob(padded)
    return JSON.parse(decoded)
  } catch {
    return {}
  }
}

function saveSession(session) {
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
}

function readSession() {
  const rawValue = sessionStorage.getItem(AUTH_SESSION_KEY)
  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue)
  } catch {
    return null
  }
}

function clearSession() {
  sessionStorage.removeItem(AUTH_SESSION_KEY)
  clearOAuthCallbackState()
}

function clearOAuthCallbackState() {
  sessionStorage.removeItem(PKCE_VERIFIER_KEY)
  sessionStorage.removeItem(OAUTH_STATE_KEY)
}

function removeAuthorizationCodeFromUrl() {
  const url = new URL(window.location.href)
  if (url.searchParams.has('code')) {
    url.searchParams.delete('code')
  }
  if (url.searchParams.has('state')) {
    url.searchParams.delete('state')
  }
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)
}

async function provisionApplicationUser(idToken) {
  let response

  try {
    response = await fetch(`${AWS_CONFIG.apiBaseUrl}/users/profile`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    throw new Error(`User profile provisioning request failed: ${error.message}`)
  }

  const responseText = await response.text()
  let result
  try {
    result = responseText ? JSON.parse(responseText) : null
  } catch {
    result = null
  }

  if (response.status !== 200 && response.status !== 201) {
    const detail = result?.message || responseText || response.statusText
    throw new Error(`User profile provisioning failed (HTTP ${response.status}): ${detail}`)
  }

  if (typeof result?.userId !== 'string' || !result.userId.trim()) {
    throw new Error('User profile provisioning response did not include a valid userId.')
  }

  return result.userId.trim()
}

export function initializeAuthFromCallback() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')

  if (!code) {
    return callbackPromise || Promise.resolve(false)
  }

  if (callbackCode === code && callbackPromise) {
    return callbackPromise
  }

  callbackCode = code
  callbackPromise = processAuthCallback(url).finally(() => {
    callbackCode = null
    callbackPromise = null
  })
  return callbackPromise
}

async function processAuthCallback(url) {
  const code = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state')
  const savedState = sessionStorage.getItem(OAUTH_STATE_KEY)
  if (!returnedState || !savedState || returnedState !== savedState) {
    clearOAuthCallbackState()
    removeAuthorizationCodeFromUrl()
    return false
  }

  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY)
  if (!verifier) {
    clearOAuthCallbackState()
    removeAuthorizationCodeFromUrl()
    return false
  }

  const params = new URLSearchParams()
  params.append('grant_type', 'authorization_code')
  params.append('client_id', AWS_CONFIG.clientId)
  params.append('code', code)
  params.append('redirect_uri', AWS_CONFIG.redirectUri)
  params.append('code_verifier', verifier)

  const response = await fetch(`${AWS_CONFIG.cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    clearOAuthCallbackState()
    removeAuthorizationCodeFromUrl()

    let tokenError
    try {
      tokenError = JSON.parse(errorText)?.error
    } catch {
      tokenError = null
    }

    if (tokenError === 'invalid_grant') {
      return false
    }

    throw new Error(`Token exchange failed: ${errorText}`)
  }

  const tokens = await response.json()
  const idTokenPayload = decodeJwtPayload(tokens.id_token)
  clearOAuthCallbackState()
  removeAuthorizationCodeFromUrl()

  const session = {
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    issuedAt: Date.now(),
    user: idTokenPayload,
  }

  try {
    session.applicationUserId = await provisionApplicationUser(session.idToken)
    saveSession(session)
  } catch (provisionError) {
    clearSession()
    throw provisionError
  }

  return true
}

export async function ensureApplicationUserProfile() {
  const session = readSession()
  if (!session?.idToken) {
    throw new Error('Authentication required before provisioning a user profile.')
  }

  if (session.applicationUserId) {
    return session.applicationUserId
  }

  try {
    session.applicationUserId = await provisionApplicationUser(session.idToken)
    saveSession(session)
    return session.applicationUserId
  } catch (provisionError) {
    clearSession()
    throw provisionError
  }
}

export async function login() {
  if (isAuthenticated()) {
    return getCurrentUser()
  }

  if (loginRedirectStarted) {
    return null
  }

  const verifier = generateRandomString(64)
  const challenge = await generateCodeChallenge(verifier)
  const state = generateRandomString(32)
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier)
  sessionStorage.setItem(OAUTH_STATE_KEY, state)

  const params = new URLSearchParams({
    client_id: AWS_CONFIG.clientId,
    response_type: 'code',
    scope: AWS_CONFIG.scopes.join(' '),
    redirect_uri: AWS_CONFIG.redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  const authorizeUrl = `${AWS_CONFIG.cognitoDomain}/oauth2/authorize?${params.toString()}`
  loginRedirectStarted = true
  window.location.assign(authorizeUrl)
  return null
}

export function logout() {
  clearSession()

  const logoutUrl = `${AWS_CONFIG.cognitoDomain}/logout?client_id=${encodeURIComponent(AWS_CONFIG.clientId)}&logout_uri=${encodeURIComponent(AWS_CONFIG.logoutRedirectUri)}`
  window.location.assign(logoutUrl)
}

export function getAccessToken() {
  const session = readSession()
  return session?.accessToken || null
}

export function getCurrentUser() {
  const session = readSession()
  return session?.user || null
}

export function getCurrentUserId() {
  const user = getCurrentUser()
  return user?.sub || user?.email || null
}

export function getApplicationUserId() {
  return readSession()?.applicationUserId || null
}

export function isAuthenticated() {
  return Boolean(getAccessToken())
}
