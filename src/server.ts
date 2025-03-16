import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import ingressRoutes from "./routes/ingress"
import streamRoutes from "./routes/stream"
import participationRoutes from "./routes/participation"

// Load environment variables
dotenv.config()

// Check required environment variables
const requiredEnvVars = ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_WS_URL"]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: Environment variable ${envVar} is required`)
    process.exit(1)
  }
}

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use("/api", ingressRoutes)
app.use("/api", streamRoutes)
app.use("/api", participationRoutes)

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" })
})

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: "Something went wrong!" })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

