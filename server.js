var http = require('http')
, socket = require('socket.io')
, fs = require('fs')
, ams = require('ams')
, connect = require('connect')
, connectnowww = require('connect-no-www')
, app
, server
, clientDir = __dirname + '/client'
, depsDir = __dirname + '/deps'
, publicDir = __dirname + '/public'
, fontsDir = publicDir + '/fonts'
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

app = connect()
    .use(connect.logger(':status :remote-addr :url in :response-time ms'))
    .use(connectnowww())
    .use(niceifyURL)
    .use(connect.static(publicDir, {maxAge: prod ? 86400000 : 0}))
    .use(connect.static(fontsDir, {maxAge: prod ? 86400000 : 0})
);

server = http.createServer(app).listen(prod ? 80 : 3000);

socket.listen(server);