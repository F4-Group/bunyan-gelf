const dgram = require('dgram');
const util = require('util');
const GELFManager = require('gelf-manager');

const server = dgram.createSocket('udp4');
const gelfManager = new GELFManager({debug: true});

server.on('message', function (msg) {
    gelfManager.feed(msg);
});

gelfManager.on('message', function (msg) {
    console.log(msg);
});

gelfManager.on('error', function (err) {
    console.log(util.inspect(err));
});

server.on("listening", function () {
    const address = server.address();
    console.log("server listening " + address.address + ":" + address.port);
});

server.bind(12201);
