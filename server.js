var http = require('http')
, io = require('socket.io')
, express = require('express')
, connectnowww = require('connect-no-www')
, fs = require('fs')
, ams = require('ams')
, app
, server
, Game = require('./game')
, games = {}
, clientDir = __dirname + '/client'
, depsDir = __dirname + '/deps'
, publicDir = __dirname + '/public'
, fontsDir = publicDir + '/fonts'
, prod = process.env.NODE_ENV === 'production';

function configureFiles() {
    var options = {
	uglifyjs: prod,
	jstransport: false,
	cssabspath: false,
	cssdataimg: false,
	texttransport: false
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

function getGame(hash) {
    if (hash && hash in games) {
	return games[hash];
    }
    hash = getUnusedHash();
    console.log(hash);
    return (games[hash] = new Game(socket, hash));
}

function getUnusedHash() {
    do { 
	var hash = randString(5);
    } while (hash in games);
    return hash;
}

var CHARSET = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','T','V','W','X','Y','Z'];

function randString(num) {
    var string = "";
    while (string.length < num) {
	string += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
    return string;
}

configureFiles();

app = express()
    .use(niceifyURL)
    .use(express.logger(':status :remote-addr :url in :response-time ms'))
    .use(connectnowww())
    .use(express.static(publicDir), {maxAge: prod ? 86400000 : 0})
    .use(express.static(fontsDir, {maxAge: prod ? 86400000 : 0}));

server = http.createServer(app).listen(prod ? 8080 : 3000);

io = io.listen(server);

io.configure('production', function() {
  io.enable('browser client minification');  // send minified client
  io.enable('browser client etag');          // apply etag caching logic based on version number
  io.enable('browser client gzip');          // gzip the file
  io.set('log level', 1);                    // reduce logging
  io.set('transports', [                     // enable all transports (optional if you want flashsocket)
      'websocket'
    , 'flashsocket'
    , 'htmlfile'
    , 'xhr-polling'
    , 'jsonp-polling'
  ]);
});

io.sockets.on('connection', function(socket) {
    var game = null;
    io.on('initialize', function(msg) {
	game = getGame(msg.hash);
	game.registerPlayer(socket, msg.sess);
	(game.handleClientMessage('initialize', socket)).call(game, msg);
	if (msg.hash !== game.hash) {
	    socket.emit('gameHash', game.hash);
	}
    });
    
    io.on('disconnect', function() {
	if (!game) 
	    return;
	var hash = game.hash;
	game.unregisterPlayer(socket, function() {
	    delete games[hash];
	    console.log('getting rid of ' + hash);
	});
	game = null;
    });
});