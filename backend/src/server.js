import app from "./app.js";
import { env } from "./config/env.js";
import { testDatabaseConnection } from "./config/db.js";
import { startRfqEmailWorker } from "./workers/rfq-email.worker.js";
import { bootstrapInitialAccounts } from "./modules/auth/auth.service.js";

async function startServer() {
  try {
    await testDatabaseConnection();
    await bootstrapInitialAccounts();
    if (env.smtp.deliveryEnabled) {
      startRfqEmailWorker();
    } else {
      console.log("RFQ email outbox is enabled; SMTP delivery is intentionally disabled.");
    }

    app.listen(env.port, env.host, () => {
      console.log(
        `ATECH Marketing API running at http://${env.host}:${env.port}`
      );
    });
  } catch (error) {
    console.error("Unable to start server:", error);
    process.exit(1);
  }
}

startServer();
