const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { connect } = require('mongoose');
const upload = require('express-fileupload');

const Routes = require('./routes/Routes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
app.use(express.json({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    credentials: true,
    origin: ['http://localhost:3000', 'https://campus-elect.vercel.app'],
  }),
);
app.use(upload());

app.use('/api', Routes);

app.use(notFound);
app.use(errorHandler);

connect(process.env.MONGO_URI)
  .then(() =>
    app.listen(process.env.PORT, () =>
      console.log(`Server running on port ${process.env.PORT}`),
    ),
  )
  .catch((error) => console.log(error));
