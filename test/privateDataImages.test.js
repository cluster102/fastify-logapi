const test = require('tap').test;
const fastify = require('../web/server.js');

test("Successfull Post /data/private/images/:store_id test", (t) => {
  t.plan(4);

  // At the end of your tests it is highly recommended to call `.close()`
  // to ensure that all connections to external services get closed.
  fastify.inject(
    {
      method: "POST",
      url: "/data/private/images/AYGPQKbEmWb1gWLq",
      headers: {
        Authorization:
          "$2b$10$7.SzAnenUzvL406PwGqI4OdwPHKciTj2fw0R.oFuGys9NJbRVhHHm",
      },
      payload: {
        image_data: [{
        name: "logo_mustikaratu.jpg",
        size: "3290",
        type: "image/jpeg",
        path: "img/nKm1OoRWrdpXJV4g",
        ref_id: "5eb46b2c206c48342a272729",
        content_id: "2",
        image_redirecturl: "/search?q=hamburger",
        }]
      },
    },
    (err, response) => {
      t.error(err);
      t.strictEqual(response.statusCode, 200);
      t.strictEqual(
        response.headers["content-type"],
        "application/json; charset=utf-8"
      );
      t.deepEqual(JSON.parse(response.body).status, "ok");
    }
  );
});

