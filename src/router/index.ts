import express from "express";
import userRoutes from "./user.routes";
import contentRoutes from "./content.routes";
import projectRoutes from "./project.routes";
import artistRoutes from "./artists.routes";

const router = express.Router();

router.use("/user", userRoutes);
router.use("/content", contentRoutes);
router.use("/project", projectRoutes);
router.use("/artist", artistRoutes);

export default router;
