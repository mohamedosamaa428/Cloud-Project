require('dotenv').config();

const express = require('express');
const cors = require('cors');
const adminRoutes = require('./src/routes/admin');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
