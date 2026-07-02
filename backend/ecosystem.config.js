module.exports = {
  apps: [
    {
      name: "locals-backend",
      script: "./dist/index.js",
      instances: "max",             // Runs as many instances as CPU cores for load-balancing
      exec_mode: "cluster",         // Cluster mode to distribute incoming requests
      autorestart: true,            // Auto-restart on crash
      watch: false,                 // Do not watch files in production
      max_memory_restart: "1G",     // Restart if memory exceeds 1GB
      env: {
        NODE_ENV: "development",
        PORT: 3000
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
