var http = require('http')
, socket = require('socket.io')
, fs = require('fs')
, ams = require('ams')
, connect = require('connect')
, connectnowww = require('connect-no-www')
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

function niceifyURL(req, res, next){
  if (/^\/game\/public/.exec(req.url)) {
    res.writeHead(302, {
      'Location': '/game/#!/' + getLatestPublicGame().hash
    });
    return res.end();
  }
  if (/^\/game$/.exec(req.url)) {
    res.writeHead(301, { 'Location': '/game/' });
    return res.end();
  }
  if (/^\/game\//.exec(req.url)) {
    req.url = '/game.html';
  } else if (/^\/about/.exec(req.url)) {
    req.url = '/about.html';
  } else if (/^\/help/.exec(req.url)) {
    req.url = '/help.html';
  } else if (/^\/?$/.exec(req.url)) {
    req.url = '/index.html';
  }
  return next();
}

configureFiles();

server = connect.createServer(
    connect.logger(':status :remote-addr :url in :response-timems')
    , connectnowww()
    , niceifyURL
).listen(prod ? 80 : 3000);

socket.listen(server);