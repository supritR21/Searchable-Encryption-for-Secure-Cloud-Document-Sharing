import { app } from './app.js';
import { ENV } from './config/env.js';

const server = app.listen(ENV.PORT, () => {
  console.log(`[CipherShare API] running on http://localhost:${ENV.PORT}`);
  console.log(`[CipherShare API] Environment: ${ENV.NODE_ENV}`);
});

process.on('SIGTERM', () => {
  console.log('[CipherShare API] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[CipherShare API] Process terminated.');
  });
});
