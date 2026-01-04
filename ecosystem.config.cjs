/**
 * PM2 Ecosystem Configuration
 * Prompt Evolution Dashboard Server
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 stop prompt-evolution
 *   pm2 restart prompt-evolution
 *   pm2 logs prompt-evolution
 */

module.exports = {
  apps: [
    {
      name: 'prompt-evolution',
      script: 'dist/server/index.js',
      cwd: __dirname,

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },

      // Process management
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // Restart policy
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
