const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
    createTask, getAllTasks, getTask,
    updateTask, deleteTask, getTaskAuditLog, upload
} = require("../controllers/tasks.controller");

const managerOnly = (req, res, next) => {
    if (req.user.role !== "manager" && req.user.role !== "admin") {
        return res.status(403).json({ error: "Manager access required" });
    }
    next();
};

router.post("/", auth, managerOnly, upload.single("image"), createTask);
router.get("/", auth, getAllTasks);
router.get("/:taskId", auth, getTask);
router.put("/:taskId", auth, upload.single("image"), updateTask);
router.delete("/:taskId", auth, managerOnly, deleteTask);
router.get("/:taskId/audit", auth, getTaskAuditLog);

module.exports = router;