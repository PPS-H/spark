// custom.d.ts (placed inside the global 'types' folder)

import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      user?: any;
      userId: any;
    }
  }
}
