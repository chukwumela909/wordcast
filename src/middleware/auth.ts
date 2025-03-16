import type { Request, Response, NextFunction } from "express"
import { getSessionFromReq } from "../lib/controller"

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSessionFromReq(req)
    req.session = session
    next()
  } catch (err) {
    if (err instanceof Error) {
      res.status(401).json({ error: err.message })
    } else {
      res.status(401).json({ error: "Unauthorized" })
    }
  }
}

