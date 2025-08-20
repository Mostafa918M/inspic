require("dotenv").config();
const express = require('express')
const cookieParser = require('cookie-parser');
const path = require("path");

const { handleNotFound, globalError } = require('./middlewares/globalErrorHandler');

// Import routes
const authRoute = require('./routes/auth.route');
const userRoute = require('./routes/user.route');
const pinRoute = require('./routes/pin.route');





const app = express()
const UPLOADS_ROOT = path.resolve("uploads");


app.use(express.json());
app.use(cookieParser());
app.use('/media',  express.static(UPLOADS_ROOT, {
    setHeaders: (res, filePath) => {
      if (!filePath.includes(path.sep + "public" + path.sep)) {
        res.statusCode = 404;
      } else {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  })
);

app.use('/api/v1/auth', authRoute);
app.use('/api/v1/users',userRoute);
app.use('/api/v1/pins', pinRoute);




app.use(handleNotFound);
app.use(globalError);

module.exports = app