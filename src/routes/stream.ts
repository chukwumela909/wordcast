import express from "express"
import { Controller, type CreateStreamParams, type JoinStreamParams } from "../lib/controller"
import { authMiddleware } from "../middleware/auth"

const router = express.Router()
const controller = new Controller()

// Create stream
router.post("/create_stream", async (req, res) => {
  try {
    const response = await controller.createStream(req.body as CreateStreamParams)
    res.json(response)
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).json({ error: err.message })
    } else {
      res.status(500).json({ error: "Internal server error" })
    }
  }
})

// Join stream
router.post("/join_stream", async (req, res) => {
  try {
    const response = await controller.joinStream(req.body as JoinStreamParams)
    res.json(response)
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).json({ error: err.message })
    } else {
      res.status(500).json({ error: "Internal server error" })
    }
  }
})

// Stop stream
router.post("/stop_stream", authMiddleware, async (req, res) => {
  try {
    if (!req.session) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }
    await controller.stopStream(req.session)
    res.json({})
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).json({ error: err.message })
    } else {
      res.status(500).json({ error: "Internal server error" })
    }
  }
})

export default router

