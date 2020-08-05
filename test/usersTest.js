const test = require('tap').test;
const fastify = require('../web/server.js');

test('Successfull Post /vendor/store test', t => {
    t.plan(4)
        
    // At the end of your tests it is highly recommended to call `.close()`
    // to ensure that all connections to external services get closed.  
    fastify.inject({
      method: 'POST',
      url: '/vendor/store',
      headers: {Authorization: "$2b$10$7.SzAnenUzvL406PwGqI4OdwPHKciTj2fw0R.oFuGys9NJbRVhHHm"}

    }, (err, response) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.strictEqual(response.headers['content-type'], 'application/json; charset=utf-8')
        t.deepEqual(response.json(), { status: 'ok', message: 'successfully added vendor store data to redis' })
    })
})

test('Error Post /vendor/store test - Authorization fail', t => {
    t.plan(4)
        
    // At the end of your tests it is highly recommended to call `.close()`
    // to ensure that all connections to external services get closed.
  
    fastify.inject({
      method: 'POST',
      url: '/vendor/store',
      headers: {Authorization: "$2b$10$7.SzAnenUzvL406PwGqwPHKciTj2fw0R.oFuGys9NJbRVhHHm"}

    }, (err, response) => {
        t.error(err)
        t.strictEqual(response.statusCode, 401)
        t.strictEqual(response.headers['content-type'], 'application/json; charset=utf-8')
        t.deepEqual(response.json(), { status: 'fail', name: "UnauthorizedError", message: 'Invalid key' })
    })
})


test('Successfull Post /vendor/user/:id test', t => {
    t.plan(4)
        
    // At the end of your tests it is highly recommended to call `.close()`
    // to ensure that all connections to external services get closed.  
  
    fastify.inject({
      method: 'POST',
      url: '/vendor/user' + '/' + "kE05WVo3bpRrJ4X2",
      headers: {Authorization: "$2b$10$7.SzAnenUzvL406PwGqI4OdwPHKciTj2fw0R.oFuGys9NJbRVhHHm"}

    }, (err, response) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.strictEqual(response.headers['content-type'], 'application/json; charset=utf-8')
        t.deepEqual(response.json(), { status: 'ok', message: 'successfully added vendor user data to redis' })
    })
})


test('id unknown for Post /vendor/user/:id test', t => {
    t.plan(4)
        
    // At the end of your tests it is highly recommended to call `.close()`
    // to ensure that all connections to external services get closed.  
    const user_id="kE05W3bpRrJ4X2";
  
    fastify.inject({
      method: 'POST',
      url: '/vendor/user' + '/' + user_id,
      headers: {Authorization: "$2b$10$7.SzAnenUzvL406PwGqI4OdwPHKciTj2fw0R.oFuGys9NJbRVhHHm"}

    }, (err, response) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
        t.strictEqual(response.headers['content-type'], 'application/json; charset=utf-8')
        t.deepEqual(response.json(), { status: 'fail', message: `User ID: ${user_id} not found`, name: "NotFoundError" })
    })
})

test('Test failed authorization Post /vendor/user/:id', t => {
    t.plan(4)
        
    // At the end of your tests it is highly recommended to call `.close()`
    // to ensure that all connections to external services get closed.  
    t.tearDown(() => fastify.close())
    const user_id="kE05WVo3bpRrJ4X2";
  
    fastify.inject({
      method: 'POST',
      url: '/vendor/user' + '/' + user_id,
      headers: {Authorization: "$2b$10$7.SzAnenUL406PwGqI4OdwPHKciTj2fw0R.oFuGys9NJbRVhHHm"}

    }, (err, response) => {
        t.error(err)
        t.strictEqual(response.statusCode, 401)
        t.strictEqual(response.headers['content-type'], 'application/json; charset=utf-8')
        t.deepEqual(response.json(), { status: 'fail', name: "UnauthorizedError", message: 'Invalid key' })
    })
})


