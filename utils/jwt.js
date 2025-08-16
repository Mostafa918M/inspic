const jwt = require('jsonwebtoken');
const asyncErrorHandler = require('./asyncErrorHandler');

const JWT_SECRET_REFRESH = process.env.JWT_SECRET_REFRESH
const JWT_SECRET_ACCESS = process.env.JWT_SECRET_ACCESS;

const generateRefreshToken = (user)=>{

    const payload = {
        id: user._id,
        role:user.role
    }
   const RefreshToken =  jwt.sign(payload,JWT_SECRET_REFRESH,{
        expiresIn: '7d'})

    return RefreshToken;
}

const generateAccessToken = (user) => {
    const payload = {
        id: user._id,
        role: user.role
    }
    const AccessToken = jwt.sign(payload, JWT_SECRET_ACCESS, {
        expiresIn: '15m'
    })

    return AccessToken;
}

module.exports = {
    generateRefreshToken,
    generateAccessToken
}