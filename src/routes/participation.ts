import express from "express"
import { Controller, type InviteToStageParams, type RemoveFromStageParams } from "../lib/controller"
import { authMiddleware } from "../middleware/auth"

const router = express.Router()
const controller = new Controller()

// Invite to stage
router.post("/invite_to_stage", authMiddleware, async (req, res) => {
  try {
    if (!req.session) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }
    await controller.inviteToStage(req.session, req.body as InviteToStageParams)
    res.json({})
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).json({ error: err.message })
    } else {
      res.status(500).json({ error: "Internal server error" })
    }
  }
})

// Remove from stage
router.post("/remove_from_stage", authMiddleware, async (req, res) => {
  try {
    if (!req.session) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }
    await controller.removeFromStage(req.session, req.body as RemoveFromStageParams)
    res.json({})
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).json({ error: err.message })
    } else {
      res.status(500).json({ error: "Internal server error" })
    }
  }
})

// Raise hand
router.post("/raise_hand", authMiddleware, async (req, res) => {
  try {
    if (!req.session) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }
    await controller.raiseHand(req.session)
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

