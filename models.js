var mongoose = require('mongoose')
, Schema = mongoose.Schema
, config = require('./config');

var db = mongoose.createConnection(config.mongo);

var BlackCard = new Schema({
    basedeck : { type : Boolean, default : false },
    deck : String,
    desc: String,
    playstyle: { type : Number, default : 1 }
});

var WhiteCard = new Schema({
    basedeck : { type : Boolean, default : false },
    deck : String,
    desc: String
});

var models = {
    BlackCard : db.model('blackcards', BlackCard),
    WhiteCard : db.model('whitecards', WhiteCard)
};

module.exports = models;