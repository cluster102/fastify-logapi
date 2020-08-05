"use strict"

const postVoucherSchema = require('./postVoucher');
const updateVoucherSchema = require('./updateVoucher');
const deleteVoucherSchema = require('./deleteVoucher');
const getVoucherListSchema = require('./getVoucherList');

module.exports = {
    postVoucherSchema,
    updateVoucherSchema,
    deleteVoucherSchema,
    getVoucherListSchema
}