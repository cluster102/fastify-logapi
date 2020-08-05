"use strict"

const util = require("util");

module.exports =  (payload, conn) => {
    const {id} = payload;
    return new Promise(async(resolve, reject)=>{
        try {

            // TODO. define all commissions
            return resolve ({
                ewallet: 0,
                commission: 0,
                commission_should_pay: 0
            })
        } catch (err){
            console.log(err);
            return reject({err: {
                status: 500, 
                message: "InternalServerError"
            }}) 
        }
    })
}