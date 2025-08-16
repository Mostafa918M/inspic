require("dotenv").config();
const express = require('express')
const cookieParser = require('cookie-parser');

// Import routes
const authRoute = require('./routes/auth.routes');


const app = express()

app.use(express.json());
app.use(cookieParser());

app.use('/api/v1/auth', authRoute);

module.exports = app