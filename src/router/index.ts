import express from "express";
import userRoutes from "./user.routes";
import contentRoutes from "./content.routes";
import projectRoutes from "./project.routes";
import artistRoutes from "./artists.routes";
import streamingAccountRoutes from "./streamingRoutes.routes";
import paymentRoutes from "./payment.routes";
import adminRoutes from "./admin.routes";

const router = express.Router();

router.use("/user", userRoutes);
router.use("/content", contentRoutes);
router.use("/project", projectRoutes);
router.use("/artist", artistRoutes);
router.use("/socialMedia", streamingAccountRoutes);
router.use("/payment", paymentRoutes);
router.use("/admin", adminRoutes);

export default router;
