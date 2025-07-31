module.exports = {
  apps: [
    {
      name: 'landlord-backend',
      script: './backend/src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    },
    {
      name: 'landlord-frontend',
      script: 'serve',
      args: '-s frontend/build -l 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true
    },
    {
      name: 'landlord-cron',
      script: './scripts/cron-runner.js',
      instances: 1,
      autorestart: true,
      watch: false,
      cron_restart: '0 5 * * *', // Run daily at 5 AM
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/cron-error.log',
      out_file: './logs/cron-out.log',
      log_file: './logs/cron-combined.log',
      time: true
    }
  ]
};