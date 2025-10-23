import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { weatherWorkflow } from "./workflows/weather-workflow";
import { weatherAgent } from "./agents/weather-agent";
import { VercelDeployer } from "@mastra/deployer-vercel";

const deployer = new VercelDeployer({
  // Optional per-function overrides (written to .vc-config.json)
  maxDuration: 600,
  memory: 1536,
  regions: ["sfo1", "iad1"],
});

export const mastra = new Mastra({
  deployer: deployer,
  workflows: { weatherWorkflow },
  agents: { weatherAgent },
  storage: new LibSQLStore({
    // stores observability, scores, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  telemetry: {
    // Telemetry is deprecated and will be removed in the Nov 4th release
    enabled: false,
  },
  observability: {
    // Enables DefaultExporter and CloudExporter for AI tracing
    default: { enabled: true },
  },
  server: {
    build: { swaggerUI: false, apiReqLogs: false, openAPIDocs: false },

    middleware: [
      {
        handler: async (c, next) => {
          if (process.env.environment !== "DEVELOPMENT") {
            const authHeader = c.req.header("x-mastra-api-key");
            const isAuthenticated = authHeader == process.env.MASTRA_API_KEY;
            if (!authHeader || !isAuthenticated) {
              return new Response("Unauthorized", { status: 401 });
            }
          }
          await next();
        },
        path: "/api/*",
      },
      {
        handler: async (c, next) => {
          if (process.env.environment !== "DEVELOPMENT") {
            return new Response("Unauthorized", { status: 401 });
          }
          await next();
        },
        path: "/agents/*",
      },
      // Add a global request logger
      async (c, next) => {
        console.log(`${c.req.method} ${c.req.url}`);
        await next();
      },
    ],
  },
});
