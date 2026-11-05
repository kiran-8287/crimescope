import { createServer } from "http";
import { env } from "./config/env.js";
import app from "./app.js";

const server = createServer(app);
server.listen(env.API_PORT, () => {
  console.log({ port: env.API_PORT }, "CrimeScope API listening");
});

export default app;
