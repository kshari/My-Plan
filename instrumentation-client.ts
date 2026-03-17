import { initBotId } from 'botid/client/core'

/**
 * BotID client-side initialisation.
 * Lists every sensitive POST endpoint that has a corresponding checkBotId()
 * call on the server. The client will attach bot-detection headers to these
 * requests so the server can verify them.
 *
 * Run automatically by Next.js 15.3+ before the first page renders.
 */
initBotId({
  protect: [
    // AI agent — most expensive and abuse-prone endpoints
    { path: '/api/agent/chat', method: 'POST' },
    { path: '/api/agent/execute', method: 'POST' },

    // Property import — triggers external data fetch + DB writes
    { path: '/api/property/import', method: 'POST' },

    // Agent activity logging
    { path: '/api/agent/log', method: 'POST' },
  ],
})
