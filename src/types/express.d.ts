import type { Session } from "../lib/controller"

declare global {
  namespace Express {
    interface Request {
      session?: Session
    }
  }
}

