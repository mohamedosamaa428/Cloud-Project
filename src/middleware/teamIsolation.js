function teamIsolation(req, res, next) {
  const { role, teamId } = req.user;

  if (role === 'admin') {
    req.scopedTeamId = null;
    return next();
  }

  if (role === 'manager') {
    req.scopedTeamId = req.query.teamId || null;
    return next();
  }

  if (role === 'employee') {
    if (req.query.teamId && req.query.teamId !== teamId) {
      return res.status(403).json({ error: 'Forbidden: cannot access another team' });
    }
    req.scopedTeamId = teamId;
    return next();
  }

  return res.status(403).json({ error: 'Forbidden: unknown role' });
}

module.exports = teamIsolation;
