"use strict"

const config = require('../../config');

module.exports = {
    "routePrefix": "/documentation",
    "swagger": {
        "info": {
            "title": "PowerBiz logAPI",
            "description": "PowerBiz Api",
            "version":" 1.0.0"
        },
        "host": config.document_host,
        "tags": [
            { "name": "Users", "description": "User related endpoints" },
            { "name": "Users - Private", "description": "User endpoint for authorized user only" },
            { "name": "Products", "description": "Product related endpoints" },
			{ "name": "Data", "description": "Data related endpoints" },
			{ "name": "Data - Private", "description": "Private Data related endpoints" },
			{ "name": "Carts", "description": "Everything about transactions." },
			{ "name": "Promotion - Private", "description": "Everything about Promotion." }
        ],
        "schemes": ["http"],
        "consumes": ["application/json"],
		"produces": ["application/json"],
		"components": {
			"responses": {
				"BadRequestError": {
					"$id": "BadRequestError",
					"description": "Bad request, one or more param not included, or not match",
					"type": "object",
					"properties": {
						"status": {"type": "string", "description": "fail"},
						"name": {"type": "string", "description": "BadRequestError"},
						"message": {"type": "string", "description": "Error description"}
					},
					"example": {
						"status": "fail",
						"name": "BadRequestError",
						"message": "Missing storeId attribute!"
					}
				},
				"NotFoundError": {
					"$id": "NotFoundError",
					"description": "Not found, your request not found in these system",
					"type": "object",
					"properties": {
						"status": {"type": "string", "description": "fail"},
						"name": {"type": "string", "description": "NotFoundError"},
						"message": {"type": "string", "description": "Error description"}
					},
					"example": {
						"status": "fail",
						"name": "NotFoundError",
						"message": "User: test@powerbiz.asia not found in these system!"
					}
				},
				"InternalError": {
					"$id": "InternalError",
					"description": "Error on internal system",
					"type": "object",
					"properties": {
						"status": {"type": "string", "description": "fail"},
						"name": {"type": "string", "description": "InternalServerError"},
						"message": {"type": "string", "description": "Error description"}
					},
					"example": {
						"status": "fail",
						"name": "InternalServerError",
						"message": "Database error!"
					}
				},
				"UnauthorizedError": {
					"$id": "UnauthorizedError",
					"description": "Unauthorized Error",
					"type": "object",
					"properties": {
						"status": {"type": "string", "description": "fail"},
						"name": {"type": "string", "description": "UnauthorizedError"},
						"message": {"type": "string", "description": "Error description"}
					},
					"example": {
						"status": "fail",
						"name": "UnauthorizedError",
						"message": "Token expired!"
					}
				}
			}
		},
		"definitions": {
			"bannerList": {
				"$id": "bannerList",
				"summary": "response of banner list structuire",
				"description": "response of banner list structuire",
				"type": "object",
				"properties": {
					"status": {"type": "string"},
					"message": {
						"type": "array",
						"items": {
							"type": "object",
							"required": ["image_id", "image_name", "image_path", "ref_id", "type", "url", "image_redirecturl"],
							"properties": {
								"image_id": {"type": "integer", "description": "id of image"},
								"image_name": {"type": "string", "description": "file name of image"},
								"image_path": {"type": "string"},
								"ref_id": {"type": "string", "description": "id of image ini imagekit"},
								"type": {"type": "integer", "description": "type of image"},
								"url": {"type": "string", "description": "url of images"},
								"image_redirecturl": {"type": "string", "description": "redirect url if imaged clicked"}
							}
						}
					}
				},
				"example": {
					"status": "ok",
					"seller_id": "ek23qpbaO1dga61n",
					"message": [{
						"image_id": 234,
						"image_name": "20200427_greenfields_banner_all_product_FhahYQjIX.jpg",
						"image_path": "img/YZOqX3dwJvwer6xp",
						"ref_id": "5eb46b2c206c48342a272729",
						"type": 1,
						"url": "https://ik.imagekit.io/powerbiz/img/YZOqX3dwJvwer6xp/20200427_greenfields_banner_all_product_FhahYQjIX.jpg",
						"image_redirecturl": "/shop/all"
					}]
				}
			}

		},
        "securityDefinitions": {
            "apiKey": {
                "type": "token",
                "name": "Authorization",
                "in": "header"
            }
		}
    },
    exposeRoute: config.documentation
}


