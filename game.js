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
    this.resetDeck();
    this.players.forEach(function(player) {
	if (null !== player) 
	    player.score = 0;
    });
}

Game.prototype.firstFreePlayerSlot = function() {
  for (var i = 0; i < this.players.length; i++) {
    if (this.players[i] === null) return i;
  }
  for (var i = 0; i < this.players.length; i++) {
    if (!this.players[i].online) return i;
  }
  return 0;    
}

Game.prototype.getPlayerIndex = function(socket) {
  for (var i = 0; i < this.players.length; i++) {
    if (this.players[i] !== null &&
        this.players[i].socket.id === socket.id)
      return i;
  }
  return -1;
}

Game.prototype.getPlayer = function(socket) {
    var playerIndex = this.getPlayerIndex(socket);
    if (-1 === playerIndex)
	return null;

    return this.players[playerIndex];
}

Game.prototype.getBlackDeck = function() {
    // Need to implement
}

Game.prototype.getWhiteDeck = function() {
    // Need to implement
}

Game.prototype.getActivePlayers = function() {
    return this.players.filter(function(player) {
	return null !== player && player.online;
    }
}

Game.prototype.getNumPlayers = function() {
    return this.getActivePlayers.length;
}

Game.prototype.registerPlayer = function(socket, hash) {

}

Game.prototype.unregisterPlayer = function(socket, gameDone) {
    var player = this.getPlayer(socket);
    if (null === player)
	return;
    player.online = false;
    // Do some kidn of message broadcast to tell people the player left.
    setTimeout(function() {
	if (0 === self.getNumPlayers()) {
	    gameDone();
	}
    }, 600000);
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