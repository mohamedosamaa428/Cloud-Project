const {
    PutCommand, GetCommand, UpdateCommand,
    DeleteCommand, QueryCommand, ScanCommand
} = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

// We'll import docClient after we see Person 2's dynamo.js
// For now using this path — adjust if needed
const docClient = require("../db/dynamo");

const TASKS_TABLE = process.env.TASKS_TABLE || "Tasks";
const AUDITLOG_TABLE = process.env.AUDITLOG_TABLE || "AuditLog";

async function writeAuditLog(taskId, userId, oldStatus, newStatus) {
    await docClient.send(new PutCommand({
        TableName: AUDITLOG_TABLE,
        Item: {
            logId: uuidv4(),
            taskId,
            userId,
            action: "STATUS_CHANGE",
            oldStatus,
            newStatus,
            timestamp: new Date().toISOString(),
        }
    }));
}

const createTask = async (req, res) => {
    try {
        const { title, description, priority, deadline, assigneeId, teamId, projectId } = req.body;
        if (!title || !teamId || !assigneeId) {
            return res.status(400).json({ error: "title, teamId, assigneeId are required" });
        }
        const now = new Date().toISOString();
        const task = {
            taskId: uuidv4(),
            title,
            description: description || "",
            priority: priority || "MEDIUM",
            deadline: deadline || null,
            assigneeId,
            teamId,
            projectId: projectId || null,
            status: "TODO",
            imageUrl: null,
            createdBy: req.user.userId,
            createdAt: now,
            updatedAt: now,
        };
        await docClient.send(new PutCommand({ TableName: TASKS_TABLE, Item: task }));
        return res.status(201).json(task);
    } catch (err) {
        console.error("createTask error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getAllTasks = async (req, res) => {
    try {
        const { role, teamId } = req.user;
        let tasks;

        if (role === "manager" || role === "admin") {
            const result = await docClient.send(new ScanCommand({ TableName: TASKS_TABLE }));
            tasks = result.Items;
            const filterTeam = req.query.teamId;
            if (filterTeam) tasks = tasks.filter(t => t.teamId === filterTeam);
        } else {
            const result = await docClient.send(new QueryCommand({
                TableName: TASKS_TABLE,
                IndexName: "teamId-index",
                KeyConditionExpression: "teamId = :teamId",
                ExpressionAttributeValues: { ":teamId": teamId },
            }));
            tasks = result.Items;
        }

        return res.json(tasks);
    } catch (err) {
        console.error("getAllTasks error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { role, teamId } = req.user;
        const result = await docClient.send(new GetCommand({
            TableName: TASKS_TABLE, Key: { taskId }
        }));
        const task = result.Item;
        if (!task) return res.status(404).json({ error: "Task not found" });
        if (role === "employee" && task.teamId !== teamId) {
            return res.status(403).json({ error: "Access denied" });
        }
        return res.json(task);
    } catch (err) {
        console.error("getTask error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const updateTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { role, teamId, userId } = req.user;

        const existing = await docClient.send(new GetCommand({
            TableName: TASKS_TABLE, Key: { taskId }
        }));
        const task = existing.Item;
        if (!task) return res.status(404).json({ error: "Task not found" });
        if (role === "employee" && task.teamId !== teamId) {
            return res.status(403).json({ error: "Access denied" });
        }

        const validStatuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
        const { title, description, priority, deadline, assigneeId, status, imageUrl } = req.body;
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid status value" });
        }

        const now = new Date().toISOString();
        let updateExpression = "SET updatedAt = :updatedAt";
        const expressionValues = { ":updatedAt": now };
        const expressionNames = {};

        if (status && status !== task.status) {
            updateExpression += ", #status = :status";
            expressionNames["#status"] = "status";
            expressionValues[":status"] = status;
            await writeAuditLog(taskId, userId, task.status, status);
        }

        if (role === "manager" || role === "admin") {
            if (title) { updateExpression += ", title = :title"; expressionValues[":title"] = title; }
            if (description !== undefined) { updateExpression += ", description = :desc"; expressionValues[":desc"] = description; }
            if (priority) { updateExpression += ", priority = :priority"; expressionValues[":priority"] = priority; }
            if (deadline) { updateExpression += ", deadline = :deadline"; expressionValues[":deadline"] = deadline; }
            if (assigneeId) { updateExpression += ", assigneeId = :assigneeId"; expressionValues[":assigneeId"] = assigneeId; }
            if (imageUrl) { updateExpression += ", imageUrl = :imageUrl"; expressionValues[":imageUrl"] = imageUrl; }
        }

        const updated = await docClient.send(new UpdateCommand({
            TableName: TASKS_TABLE,
            Key: { taskId },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionValues,
            ...(Object.keys(expressionNames).length && { ExpressionAttributeNames: expressionNames }),
            ReturnValues: "ALL_NEW",
        }));

        return res.json(updated.Attributes);
    } catch (err) {
        console.error("updateTask error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const deleteTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const existing = await docClient.send(new GetCommand({
            TableName: TASKS_TABLE, Key: { taskId }
        }));
        if (!existing.Item) return res.status(404).json({ error: "Task not found" });
        await docClient.send(new DeleteCommand({
            TableName: TASKS_TABLE, Key: { taskId }
        }));
        return res.json({ message: "Task deleted" });
    } catch (err) {
        console.error("deleteTask error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getTaskAuditLog = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { role, teamId } = req.user;
        const existing = await docClient.send(new GetCommand({
            TableName: TASKS_TABLE, Key: { taskId }
        }));
        const task = existing.Item;
        if (!task) return res.status(404).json({ error: "Task not found" });
        if (role === "employee" && task.teamId !== teamId) {
            return res.status(403).json({ error: "Access denied" });
        }
        const result = await docClient.send(new QueryCommand({
            TableName: AUDITLOG_TABLE,
            IndexName: "taskId-index",
            KeyConditionExpression: "taskId = :taskId",
            ExpressionAttributeValues: { ":taskId": taskId },
        }));
        return res.json(result.Items);
    } catch (err) {
        console.error("getTaskAuditLog error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = { createTask, getAllTasks, getTask, updateTask, deleteTask, getTaskAuditLog };