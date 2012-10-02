var Game = function(socket, hash) {
    this.socket = socket;
    this.players = [null, null, null, null, null, null, null, null, null, null];
    this.hash = hash;

    this.reset();
}

Game.prototype.resetDeck = function() {
    this.blackDeck = getBlackDeck();
    this.whiteDeck = getWhiteDeck();

    shuffle(this.blackDeck);
    shuffle(this.whiteDeck);
}

Game.prototype.reset = function() {
    this.players.forEach(function(player) {
	if (null !== player) 
	    player.score = 0;
    });
    this.resetDeck();
}

function BlackCard(desc, action) {
    this.desc = desc;
    this.action = action;
}

function WhiteCard(desc) {
    this.desc = desc;
}

function Player(socket, hash) {
    this.socket = socket;
    this.hash = hash;
    this.score = 0;
}

//+ Jonas Raoni Soares Silva
//@ http://jsfromhell.com/array/shuffle [rev. #1]
function shuffle(v){
    for(var j, x, i = v.length;
      i;
      j = Math.floor(Math.random() * i), x = v[--i], v[i] = v[j], v[j] = x)
    ;
    return v;
};