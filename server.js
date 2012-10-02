var socket = require('socket.io')
, fs = require('fs')
, ams = require('ams')
, connect = require('connect')
, server
, clientDir = __dirname + '/client'
, depsDir = __dirname + '/deps'
, publicDir = __dirname + '/public'
, fontsDir = __dirname + '/fonts'
, prod = process.env.NODE_ENV === 'prod';

function configureFiles() {
    var options = {
	uglifyjs: true
    };
    ams.build
	.create(publicDir)
	.add(clientDir + '/client.js')
	.add(clientDir + '/style.css')
	.add(depsDir + '/headjs/src/load.js')
	.process(options)
	.write(publicDir)
	.end()    
};

configureFiles();

server = connect.createServer(
    connect.logger(':status :remote-addr :url in :response-timems')
).listen(prod ? 80 : 4567);

socket.listen(server);