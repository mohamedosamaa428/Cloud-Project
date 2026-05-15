const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
    createProject, getAllProjects, getProject, updateProject, deleteProject
} = require("../controllers/projects.controller");

const managerOnly = (req, res, next) => {
    if (req.user.role !== "manager" && req.user.role !== "admin") {
        return res.status(403).json({ error: "Manager access required" });
    }
    next();
};

router.post("/", auth, managerOnly, createProject);
router.get("/", auth, getAllProjects);
router.get("/:projectId", auth, getProject);
router.put("/:projectId", auth, managerOnly, updateProject);
router.delete("/:projectId", auth, managerOnly, deleteProject);

module.exports = router;