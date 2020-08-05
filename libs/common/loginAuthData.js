

module.exports = (payload, fastify) => {
    return new Promise(async(resolve, reject)=> {
        const {headers, user_data} = payload;
        const { db, redis} = fastify;
        try {
            redis.select(2, (err)=>{
                // save for saving data
                let user_sessiondata = {
                    from: headers["x-forwarded-for"],
                    origin: headers.origin,
                    key: user_data.key
                };
                
                // save for sesion data
                redis.set(
                    user_data.login_id,
                    JSON.stringify(user_sessiondata),
                    "EX",
                    1800
                );

                // add log data
                let logData = {
                    user_id: user_data.id,
                    userlog_ids: 3,
                    userlog_ips: headers["x-forwarded-for"],
                    userlog_data: headers.referer
                }

                db.query('INSERT INTO tb_userlog SET ?', logData, (res, message) => {
                    // back to 0 gain to make sure the next process uses redis 0
                    redis.select(0, (err)=>{
                        return resolve(true);
                    })
                });    
            })
        } catch (err){
            return resolve(false);
        }
    })
}