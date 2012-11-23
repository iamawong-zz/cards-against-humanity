var CLIENT_EVENTS = ['init', 'chat', 'select', 'submit', 'start']
, models = require('./models');

var Game = function(hash) {
    this.players = [null, null, null, null, null, null, null, null, null, null];
    this.hash = hash;
    this.gameAdminIdx = 0;
    this.messages = [];
    this.blackDeck = [];
    this.whiteDeck = [];
    this.black = "";
    this.started = false;
};

Game.prototype.registerPlayer = function(socket, session) {
    if (this.getNumPlayers() >= this.players.length) {
	return false;
    }

    var self = this;
    CLIENT_EVENTS.forEach(function(event) {
	socket.on(event, self.handleClientMessage(event, socket));
    });
    if (this.playerRejoined(socket, session)) {
	return true;
    }
    
    var playerIndex = this.firstFreePlayerSlot();
    this.broadcast('join', playerIndex);
    this.players[playerIndex] = new Player(socket, session);

    this.sendMsg({event: true, msg: 'Player ' + (playerIndex + 1) + ' has joined.'});
    this.updateAdmin();
    this.updatePlayersNeeded();
}

Game.prototype.unregisterPlayer = function(socket, gameDone) {
    var playerIndex = this.getPlayerIndex(socket);
    if (-1 === playerIndex)
	return;
    var player = this.players[playerIndex];
    player.online = false;
    this.broadcast('leave', playerIndex);
    this.sendMsg({event: true, msg: 'Player ' + (playerIndex + 1) + ' has disconnected.'});
    this.updateAdmin();
    this.updatePlayersNeeded();
    var self = this;
    setTimeout(function() {
	if (0 === self.getNumPlayers()) {
	    gameDone();
	}
    }, 600000);
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

Game.prototype.getNumPlayers = function() {
    return this.getActivePlayers().length;
}

Game.prototype.getActivePlayers = function() {
    var self = this;
    return this.players.filter(function(player) {
	return self.isActivePlayer(player);
    });
}

Game.prototype.isActivePlayer = function(player) {
    return null !== player && player.online;
}

Game.prototype.getPlayerData = function() {
    var playerData = {};
    for (var i = 0; i < this.players.length; i++) {
	var player = this.players[i];
	if (null !== player) {
	    playerData[i] = {
		score: player.score,
		online: player.online		
	    };
	}
    }
    return playerData;
}

Game.prototype.playerRejoined = function(socket, session) {
    for (var i = 0; i < this.players.length; i++) {
	var player = this.players[i];
	if (null === player) {
	    continue;
	}
	if (player.socket.id === socket.id || player.session === session) {
	    if (!player.online) {
		this.broadcast('rejoin', i);
		this.sendMsg({event: true, msg: 'Player ' + (i + 1) + ' has reconnected.'});
	    }
	    player.online = true;
	    player.socket = socket;
	    player.session = session;
	    this.updateAdmin();
	    this.updatePlayersNeeded();
	    return true;
	}
    }
    return false;
}

Game.prototype.updateAdmin = function() {
    var player = this.players[this.gameAdminIdx];
    if (!this.isActivePlayer(player)) {
	for (var i = 0; i < this.players.length; i++) {
	    if (this.isActivePlayer(this.players[i])) {
		this.gameAdminIdx = i;
		break;
	    }
	}
    }
    this.broadcast('admin', this.gameAdminIdx);
}

Game.prototype.updatePlayersNeeded = function() {
    if (!this.started) {
	this.broadcast('remaining', 3 - this.getNumPlayers());
    }
}

Game.prototype.fixPlayerHand = function(playerIdx) {
    var player = this.players[playerIdx];
    var tempHand = player.hand.filter(function(card) {
	return null !== card;
    });
    while (tempHand.length < 10 && this.whiteDeck.length > 0) {
	tempHand.push(this.getWhiteCard());
    }
    player.hand = tempHand;
    player.socket.emit('newHand', {
	hand: tempHand
    });
}

Game.prototype.getWhiteCard = function() {
    if (this.whiteDeck.length <= 0) {
	this.broadcast('white');
	return;
    }
    return this.whiteDeck.shift();
}

Game.prototype.nextRound = function() {
    if (0 < this.deckUpdatesRemaining) {
	return;
    }
    this.submittedWhites = [];
    if (this.blackDeck.length <= 0) {
	this.broadcast('gameover');
	this.started = false;
	return;
    }
    // Update the TZAR index and also get the black card.
    do {
	this.tzarIdx = ++this.tzarIdx % this.players.length;
	var tzar = this.players[this.tzarIdx];
    } while (!this.isActivePlayer(tzar));
    this.broadcast('tzar', this.tzarIdx);

    this.black = this.blackDeck.shift();
    
    this.broadcast('round', {
	action: this.black.action,
	blacks: this.blackDeck.length, 
	desc: this.black.desc,
	tzarIdx: this.tzarIdx
    });
}

Game.prototype.broadcast = function(event, message) {
    console.log('for game: ' + this.hash);
    console.log('broadcasting event: ' + event + ' with message: ' + message);
    this.players.forEach(function(player) {
	if (null !== player) {
	    player.socket.emit(event, message);
	}
    });
}

Game.prototype.handleClientMessage = function(event, socket) {
    var self = this;
    return function(msg) {
	var playerIdx = self.getPlayerIndex(socket);
	if (-1 === playerIdx) {
	    return;
	}
	console.log('receiving ' + event + ' from player ' + playerIdx + ' with message ' + msg);
	self[event].call(self, playerIdx, msg);
    }
}

Game.prototype.initialize = function(playerIdx) {
    this.players[playerIdx].socket.emit('initPlayer', {
	adminIdx: this.gameAdminIdx,
	blacks: this.blackDeck.length,
	desc: this.black.desc,
	hand: this.players[playerIdx].hand,
	myIdx: playerIdx,
	msgs: this.messages,
	players: this.getPlayerData(),
	remaining: 3 - this.getNumPlayers(),
	started: this.started,
	tzarIdx: this.tzarIdx
    });
    if (this.started) {
	this.submitBroadcast();
    }
}

Game.prototype.chat = function(playerIdx, msg) {
    if (msg.length > 1024) return;
    msg = msg.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
    return this.sendMsg({ player: playerIdx, msg: msg });
}

Game.prototype.sendMsg = function(msg) {
    this.messages.push(msg);
    if (this.messages.length > 15) this.messages.shift();
    this.broadcast('msg', msg);
}

Game.prototype.select = function(playerIdx, card) {
    console.log("player " + playerIdx + " selected card " + card.desc);
    var winnerIdx;
    for (var i = 0; i < this.submittedWhites.length; i++) {
	var whiteCard = this.submittedWhites[i];
	if (whiteCard.desc == card.desc) {
	    winnerIdx = whiteCard.playerIdx;
	    break;
	}
    }
    var winner = this.players[winnerIdx];
    winner.score += 1;
    this.broadcast('score', {
	card: card.desc,
	score: winner.score,
	playerIdx: winnerIdx
    });
    this.nextRound();
}

Game.prototype.submit = function(playerIdx, card) {
    var player = this.players[playerIdx];
    for (var i = 0; i < player.hand.length; i++) {
	var handCard = player.hand[i];
	if (null !== handCard && handCard.desc === card.desc) {
	    handCard.playerIdx = playerIdx;
	    this.submittedWhites.push(handCard);
	    player.hand[i] = null;
	    break;
	}
    }
    this.submitBroadcast();
    this.fixPlayerHand(playerIdx);
}

Game.prototype.submitBroadcast = function() {
    if (this.submittedWhites.length === (this.getNumPlayers()-1)) {
	shuffle(this.submittedWhites);
	this.broadcast('allsubmitted', {
	    submitted: this.submittedWhites
	});
    } else {
	this.broadcast('submitted', this.submittedWhites.length);
    }
}

Game.prototype.start = function() {
    this.players.forEach(function(player) {
	if (null !== player) 
	    player.score = 0;
    });
    this.tzarIdx = -1;
    this.started = true;
    this.resetDeck();
}

Game.prototype.refillPlayerHand = function() {
    for (var i = 0; i < this.players.length; i++) {
	var player = this.players[i];
	if (!this.isActivePlayer(player)) {
	    continue;
	}
	this.fixPlayerHand(i);
    }
}

Game.prototype.resetDeck = function(){
    this.deckUpdatesRemaining = 2;
    this.getBlackDeck();
    this.getWhiteDeck();
}

Game.prototype.getBlackDeck = function() {
    var self = this;
    models.BlackCard.find({ deck : /default/i }, function(err, queryResult) {
	var blackDeck = queryResult.map(function(card) {
	    return new BlackCard(card.desc, card.playstyle)
	});
	self.blackDeck = shuffle(blackDeck);
	self.deckUpdatesRemaining -= 1;
	self.nextRound();
    });
}

Game.prototype.getWhiteDeck = function() {
    var self = this;
    models.WhiteCard.find({ deck : /default/i }, function (err, queryResult) {
	var whiteDeck = queryResult.map(function(card) {
	    return new WhiteCard(card.desc);
	});
	self.whiteDeck = shuffle(whiteDeck);
	self.deckUpdatesRemaining -= 1;
	self.refillPlayerHand();
	self.nextRound();
    });
}

function BlackCard(desc, action) {
    this.desc = desc;
    this.action = action;
}

function WhiteCard(desc) {
    this.desc = desc;
}

function Player(socket, session) {
    this.socket = socket;
    this.session = session;
    this.score = 0;
    this.online = true;
    this.hand = [null, null, null, null, null, null, null, null, null, null];
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

module.exports = Game;