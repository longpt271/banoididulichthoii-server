require('dotenv').config();
const port = process.env.PORT || 5000;
const mongoUser = process.env.MONGO_USER;
const mongoPassword = process.env.MONGO_PASSWORD;
const mongoDefaultDatabase = process.env.MONGO_DEFAULT_DATABASE;
const mongoDB_URI = `mongodb+srv://${mongoUser}:${mongoPassword}@cluster0.ib4yh9l.mongodb.net/${mongoDefaultDatabase}?retryWrites=true&w=majority`;

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParse = require('cookie-parser');
const mongoose = require('mongoose');

const tourRoutes = require('./routes/tour');
const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(bodyParser.json()); // application/json
app.use(bodyParser.urlencoded({ extended: false })); // x-www-form-urlencoded parser
app.use(cookieParse());

// middleware cors
app.use(
  cors({
    origin: [
      'https://didulichthoii.firebaseapp.com',
      'https://didulichthoii-admin.firebaseapp.com',
    ],
    methods: 'OPTIONS, GET, POST, PUT, PATCH, DELETE',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true, // hỗ trợ sử dụng cookie
  })
);

// routes
app.use('/api/tours', tourRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/cookies', (req, res) => res.json(req.cookies));

// middleware handler error
app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

// connect
mongoose
  .connect(mongoDB_URI)
  .then(result => {
    console.log('connected');
    app.listen(port, () => console.log(`Server is running on port ${port}`));
  })
  .catch(err => console.log(err));
