const createApp = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');

async function main() {
  await connectDB();
  const app = createApp();
  app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error('[fatal] failed to start server', err);
  process.exit(1);
});
