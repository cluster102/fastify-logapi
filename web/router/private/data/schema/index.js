'use strict'
const vendorDashboardSchema = require('./vendorDashboard');
const sellerDashboardSchema = require('./sellerDashboard');
const postBannerSchema = require('./postBanner');
const getBannerSchema = require('./getBanner');
const deleteBannerSchema = require('./deleteBanner');
const postImagesSchema = require('./postImages');
const getResellerBannerListSchema = require('./getResellerBanner.json')
const getTokenSchema = require('./getToken')

module.exports = {
    sellerDashboardSchema,
    vendorDashboardSchema,
    postBannerSchema,
    getBannerSchema,
    postImagesSchema,
    deleteBannerSchema,
    getResellerBannerListSchema,
    getTokenSchema
}