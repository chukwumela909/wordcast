import express from "express"
import { Controller, type CreateIngressParams } from "../lib/controller"

const router = express.Router()
const controller = new Controller()

// Create ingress
router.post("/create_ingress", async (req, res) => {
  try {
    const response = await controller.createIngress(req.body as CreateIngressParams)
    res.json(response)
  } catch (err) {
    console.log(err)
    if (err instanceof Error) {
      res.status(500).json({ error: err.message })
    } else {
      res.status(500).json({ error: "Internal server error" })
    }
  }
})

export default router

