'use strict'

const login = require('./login');
const register = require('./register');
const confirmSeller = require('./confirmSeller');
const confirmUser = require('./confirmUser');
const getConfirmData = require('./getConfirmData');
const checkEmail = require('./checkEmail');
const resetPasswordReq = require('./resetPasswordReq')
const putResetPasswordReq = require('./putResetPasswordReq')
module.exports = {
        loginSchema: login,
        registerSchema: register,
        confirmSellerSchema: confirmSeller,
        confirmUserSchema: confirmUser,
        getConfirmDataSchema: getConfirmData,
        checkEmailSchema: checkEmail,
        resetPasswordReqSchema: resetPasswordReq,
        putResetPasswordReqSchema: putResetPasswordReq
}