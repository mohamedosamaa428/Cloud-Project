const { PutCommand, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");
const docClient = require("../db/dynamo");

const COMMENTS_TABLE = process.env.COMMENTS_TABLE || "Comments";
const TASKS_TABLE = process.env.TASKS_TABLE || "Tasks";

const createComment = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { content } = req.body;
        const { role, teamId, userId } = req.user;
        if (!content) return res.status(400).json({ error: "content is required" });

        const taskResult = await docClient.send(new GetCommand({
            TableName: TASKS_TABLE, Key: { taskId }
        }));
        const task = taskResult.Item;
        if (!task) return res.status(404).json({ error: "Task not found" });
        if (role === "employee" && task.teamId !== teamId) {
            return res.status(403).json({ error: "Access denied" });
        }

        const comment = {
            commentId: uuidv4(), taskId,
            authorId: userId, content,
            createdAt: new Date().toISOString(),
        };
        await docClient.send(new PutCommand({ TableName: COMMENTS_TABLE, Item: comment }));
        return res.status(201).json(comment);
    } catch (err) {
        console.error("createComment error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getComments = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { role, teamId } = req.user;

        const taskResult = await docClient.send(new GetCommand({
            TableName: TASKS_TABLE, Key: { taskId }
        }));
        const task = taskResult.Item;
        if (!task) return res.status(404).json({ error: "Task not found" });
        if (role === "employee" && task.teamId !== teamId) {
            return res.status(403).json({ error: "Access denied" });
        }

        const result = await docClient.send(new QueryCommand({
            TableName: COMMENTS_TABLE,
            IndexName: "taskId-index",
            KeyConditionExpression: "taskId = :taskId",
            ExpressionAttributeValues: { ":taskId": taskId },
        }));
        return res.json(result.Items);
    } catch (err) {
        return res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = { createComment, getComments };