require('dotenv').config();

module.exports = {
  apps: [
    {
      name: "server",
      script: "./server/index.mjs",
      watch: true,
      ignore_watch: ["node_modules", "logs"],
      error_file: "./logs/server_err.log",
      out_file: "./logs/server_out.log",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "intellect",
      script: "./services/intellect.mjs",
      watch: true,
      ignore_watch: ["node_modules", "logs"],
      error_file: "./logs/intellect_err.log",
      out_file: "./logs/intellect_out.log",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "agents",
      script: "./agent_manager/main.js",
      watch: true,
      ignore_watch: ["node_modules", "logs"],
      error_file: "./logs/agents_err.log",
      out_file: "./logs/agents_out.log",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "listener",
      script: "./services/listener.mjs",
      watch: true,
      ignore_watch: ["node_modules", "logs"],
      error_file: "./logs/listener_err.log",
      out_file: "./logs/listener_out.log",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
  restart_delay: 10000, // 10 seconds delay before restarting
  max_restarts: 3,
  min_uptime: 1000 * 60 * 5, // considered successfully started after 5 minutes
};
