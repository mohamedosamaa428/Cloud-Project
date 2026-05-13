const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const docClient = require('../db/dynamo');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }
  next();
}

router.use(authMiddleware, adminOnly);

router.post('/teams', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Team name is required' });
  }

  const teamId = uuidv4();

  try {
    await docClient.send(
      new PutCommand({
        TableName: 'Teams',
        Item: {
          teamId,
          name,
          memberIds: [],
        },
      })
    );
    res.status(201).json({ teamId, name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create team' });
  }
});

router.post('/teams/:teamId/members', async (req, res) => {
  const { teamId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: 'Teams',
        Key: { teamId },
        UpdateExpression: 'SET memberIds = list_append(if_not_exists(memberIds, :empty), :userId)',
        ExpressionAttributeValues: {
          ':empty': [],
          ':userId': [userId],
        },
      })
    );

    await docClient.send(
      new UpdateCommand({
        TableName: 'Users',
        Key: { userId },
        UpdateExpression: 'SET teamId = :teamId',
        ExpressionAttributeValues: {
          ':teamId': teamId,
        },
      })
    );

    res.status(200).json({ teamId, userId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

module.exports = router;
