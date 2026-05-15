const express = require("express");
const router = express.Router({ mergeParams: true });
const auth = require("../middleware/auth");
const { createComment, getComments } = require("../controllers/comments.controller");

router.post("/", auth, createComment);
router.get("/", auth, getComments);

module.exports = router;