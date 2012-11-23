var ams = require('ams')
, path = require('path')
, config = require('./config')
, publicDir = __dirname + '/public';

module.exports = function() {
    configureFiles();
};

function configureFiles() {
    var options = {
	uglifyjs: config.prod,
	jstransport: false,
	cssabspath: false,
	cssdataimg: false,
	texttransport: false
    };
    ams.build
	.create(publicDir)
	.add(path.resolve(path.join(__dirname, 'client'), './client.js'))
	.add(path.resolve(path.join(__dirname, 'dependencies', 'headjs/src'), './load.js'))
	.process(options)
	.write(publicDir)
	.end();
};