require('dotenv').config();

module.exports = {
  apps: [
    {
      name: "server",
      script: "./server/index.mjs",
      error_file: "./logs/server_err.log",
      out_file: "./logs/server_out.log",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: '1G', // Restart if it exceeds 1 GB
    },
    {
      name: "intellect",
      script: "./services/intellect.mjs",
      error_file: "./logs/intellect_err.log",
      out_file: "./logs/intellect_out.log",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: '1G', // Restart if it exceeds 1 GB
    },
    {
      name: "agents",
      script: "./agent_manager/main.js",
      error_file: "./logs/agents_err.log",
      out_file: "./logs/agents_out.log",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: '1G', // Restart if it exceeds 1 GB
    },
    {
      name: "listener",
      script: "./services/listener.mjs",
      error_file: "./logs/listener_err.log",
      out_file: "./logs/listener_out.log",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: '1G', // Restart if it exceeds 1 GB
    },
  ],
  restart_delay: 10000, // 10 seconds delay before restarting
  max_restarts: 3,
  min_uptime: 1000 * 60 * 5, // considered successfully started after 5 minutes
  exp_backoff_restart_delay: 100, // Exponential backoff restart delay starting at 100ms
};
