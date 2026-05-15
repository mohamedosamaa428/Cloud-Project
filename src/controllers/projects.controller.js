const {
    PutCommand, GetCommand, UpdateCommand,
    DeleteCommand, ScanCommand
} = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");
const docClient = require("../db/dynamo");

const PROJECTS_TABLE = process.env.PROJECTS_TABLE || "Projects";

const createProject = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: "name is required" });
        const now = new Date().toISOString();
        const project = {
            projectId: uuidv4(), name,
            description: description || "",
            createdBy: req.user.userId,
            createdAt: now, updatedAt: now,
        };
        await docClient.send(new PutCommand({ TableName: PROJECTS_TABLE, Item: project }));
        return res.status(201).json(project);
    } catch (err) {
        console.error("createProject error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getAllProjects = async (req, res) => {
    try {
        const result = await docClient.send(new ScanCommand({ TableName: PROJECTS_TABLE }));
        return res.json(result.Items);
    } catch (err) {
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getProject = async (req, res) => {
    try {
        const result = await docClient.send(new GetCommand({
            TableName: PROJECTS_TABLE, Key: { projectId: req.params.projectId }
        }));
        if (!result.Item) return res.status(404).json({ error: "Project not found" });
        return res.json(result.Item);
    } catch (err) {
        return res.status(500).json({ error: "Internal server error" });
    }
};

const updateProject = async (req, res) => {
    try {
        const { name, description } = req.body;
        const now = new Date().toISOString();
        const updated = await docClient.send(new UpdateCommand({
            TableName: PROJECTS_TABLE,
            Key: { projectId: req.params.projectId },
            UpdateExpression: "SET #name = :name, description = :desc, updatedAt = :now",
            ExpressionAttributeNames: { "#name": "name" },
            ExpressionAttributeValues: { ":name": name, ":desc": description || "", ":now": now },
            ReturnValues: "ALL_NEW",
        }));
        return res.json(updated.Attributes);
    } catch (err) {
        return res.status(500).json({ error: "Internal server error" });
    }
};

const deleteProject = async (req, res) => {
    try {
        await docClient.send(new DeleteCommand({
            TableName: PROJECTS_TABLE, Key: { projectId: req.params.projectId }
        }));
        return res.json({ message: "Project deleted" });
    } catch (err) {
        return res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = { createProject, getAllProjects, getProject, updateProject, deleteProject };