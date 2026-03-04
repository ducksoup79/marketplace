/**
 * PM2 ecosystem file for VPS deployment.
 * Run from production/:  pm2 start ecosystem.config.cjs
 * Then:  pm2 save  &&  pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'marketplace-api',
      cwd: './backend',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      time: true,
    },
  ],
};
