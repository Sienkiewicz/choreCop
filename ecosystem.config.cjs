module.exports = {
  apps: [{
    name: 'chorecop',
    script: 'dist/index.js',
    interpreter: 'node',
    env: {
      NODE_ENV: 'production',
      TZ: 'Europe/Kyiv',
    },
    restart_delay: 5000,
    max_restarts: 10,
  }],
};
