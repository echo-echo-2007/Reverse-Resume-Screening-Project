// 全局补丁：数据库主键为 BigInt，避免 res.json() 抛 "Do not know how to serialize a BigInt"
BigInt.prototype.toJSON = function () {
  return this.toString();
};

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { router: authRouter } = require('./auth');
const { router: jobsRouter } = require('./jobs');
const { router: resumeRouter } = require('./resume');
const { router: applicationsRouter } = require('./applications');
const { router: hrRouter } = require('./hr');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api', authRouter);
app.use('/api', jobsRouter);
app.use('/api', resumeRouter);
app.use('/api', applicationsRouter);
app.use('/api', hrRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
