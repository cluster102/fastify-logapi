'use strict';
const config = require('../../config')

module.exports =  (user_type, id, conn) => {
	return new Promise( async (resolve, reject) => {
		// --- GET ALL image from selected type as response
		try {
			let result = await conn.query(`SELECT * FROM tb_images 
						WHERE user_id=? and user_type=? 
							AND content_id IN (1,2,3,4,5,6,7,12,14,15) AND is_valid=1`,
							[id, user_type]);

			return resolve (result[0].map(dt=>({
					image_id: dt.id, 
					image_name: dt.image_name,
					image_path: dt.image_path,
					ref_id: dt.ref_id,
					url: `${config.images.url}/${dt.image_path}/${dt.image_name}`,
					image_redirecturl: dt.image_redirecturl,
					type: dt.content_id
				})
			))
		} catch(err){
			return resolve([]);
		}
	})
}