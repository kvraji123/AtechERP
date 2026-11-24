import { Router } from "express";

import { requireAdministrator } from "../../middleware/requireAdministrator.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./auth.controller.js";

const router = Router();

router.post("/login", asyncHandler(controller.login));
router.post("/logout", asyncHandler(controller.logout));
router.get("/me", asyncHandler(controller.me));
router.post("/change-password", asyncHandler(controller.changePassword));
router.get("/users", requireAdministrator, asyncHandler(controller.listUsers));
router.post("/users", requireAdministrator, asyncHandler(controller.createUser));

export default router;
