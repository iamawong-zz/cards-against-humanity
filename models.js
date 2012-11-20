var mongoose = require('mongoose')
, db = mongoose.createConnection('localhost', 'cah')
, Schema = mongoose.Schema;

var BlackCard = new Schema({
    desc: String,
    type: Number
});

var BlackDeck = new Schema({
    name: String,
    cards: [BlackCard]
});

var WhiteCard = new Schema({
    desc: String
});

var WhiteDeck = new Schema({
    name: String,
    cards: [WhiteCard]
});

var models = {
    BlackCard : db.model('BlackCard', BlackCard),
    BlackDeck : db.model('BlackDeck', BlackDeck),
    WhiteCard : db.model('WhiteCard', WhiteCard),
    WhiteDeck : db.model('WhiteDeck', WhiteDeck),
};

module.exports = models;