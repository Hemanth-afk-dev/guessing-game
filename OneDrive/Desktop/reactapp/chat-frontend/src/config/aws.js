export const AWS_CONFIG = {
  region: 'us-east-1',
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL ||
    'https://fsp0loi5og.execute-api.us-east-1.amazonaws.com',
  websocketUrl:
    import.meta.env.VITE_WEBSOCKET_URL ||
    'wss://3ie1ecog2h.execute-api.us-east-1.amazonaws.com/production',
  userPoolId:
    import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_ycv43YmcR',
  clientId:
    import.meta.env.VITE_COGNITO_CLIENT_ID || '7a83gg1bsfvj61rsoe0mfsc3d1',
  cognitoDomain:
    import.meta.env.VITE_COGNITO_DOMAIN ||
    'https://us-east-1ycv43ymcr.auth.us-east-1.amazoncognito.com',
  redirectUri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173',
  logoutRedirectUri:
    import.meta.env.VITE_LOGOUT_REDIRECT_URI || 'http://localhost:5173',
  scopes: (import.meta.env.VITE_COGNITO_SCOPES || 'openid email').split(' '),
  currentUserId: null,
}
