var CLIENT_EVENTS = ['init', 'select', 'submit', 'start'];

var Game = function(socket, hash) {
    this.socket = socket;
    this.players = [null, null, null, null, null, null, null, null, null, null];
    this.hash = hash;
    this.gameAdminIndex = 0;

    this.reset();
}

Game.prototype.resetDeck = function() {
    this.blackDeck = this.getBlackDeck();
    this.whiteDeck = this.getWhiteDeck();

    shuffle(this.blackDeck);
    shuffle(this.whiteDeck);
}

Game.prototype.getBlackDeck = function() {
    // Need to implement
    return [new BlackCard("What is Batman's guilty pleasure?", 1),
	    new BlackCard("What ended my last relationship?", 1),
	    new BlackCard("What's that sound?", 1)];
}

Game.prototype.getWhiteDeck = function() {
    // Need to implement
    return [new WhiteCard("Being on fire."),
	    new WhiteCard("Racism."),
	    new WhiteCard("Old-people smell."),
	    new WhiteCard("A micropenis."),
	    new WhiteCard("Women in yogurt commercials."),
	    new WhiteCard("Classist undertones."),
	    new WhiteCard("Not giving a shit about the Third World."),
	    new WhiteCard("Sexting."),
	    new WhiteCard("Roofies."),
	    new WhiteCard("A windmill full of corpses."),
	    new WhiteCard("The gays."),
	    new WhiteCard("Oversized lollipops."),
	    new WhiteCard("African children."),
	    new WhiteCard("An asymmetric boob job."),
	    new WhiteCard("Bingeing and purging."),
	    new WhiteCard("The hardworking Mexican."),
	    new WhiteCard("An Oedipus complex."),
	    new WhiteCard("A tiny horse."),
	    new WhiteCard("Boogers."),
	    new WhiteCard("Penis envy."),];
}

Game.prototype.reset = function() {
    this.resetDeck();
    this.players.forEach(function(player) {
	if (null !== player) 
	    player.score = 0;
    });
    this.tzarIdx = -1;
}

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
    // send message?
    this.players[playerIndex] = new Player(socket, session);
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
    this.updateAdmin();
    this.updatePlayersNeeded();
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
		// send message?
	    }
	    player.online = true;
	    player.socket = socket;
	    player.session = session;
	    this.updateAdmin();
	    this.updatePlayersNeeded();
	    return true;
	}
    }
}

Game.prototype.updateAdmin = function() {
    var player = this.players[this.gameAdminIndex];
    if (!this.isActivePlayer(player)) {
	for (var i = 0; i < this.players.length; i++) {
	    if (this.isActivePlayer(this.players[i])) {
		this.gameAdminIndex = i;
		break;
	    }
	}
    }
    this.broadcast('admin', this.gameAdminIndex);
}

Game.prototype.updateTzar = function() {
    do {
	this.tzarIdx = ++this.tzarIdx % this.players.length;
	var tzar = this.players[this.tzarIdx];
    } while (this.isActivePlayer(tzar));
    this.broadcast('tzar', this.tzarIdx);
}

Game.prototype.updatePlayersNeeded = function() {
    var numPlayers = this.getNumPlayers();
    // If the game has started already, perhaps we can handle it better.
    if (!this.started && numPlayers < 3) {
	this.broadcast('remaining', 3 - numPlayers);
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
    var info = {
	playerIdx : playerIdx,
	hand: tempHand
    };
    this.broadcast('newHand', info);
}

Game.prototype.getWhiteCard = function() {
    if (this.whiteDeck.length <= 0) {
	this.broadcast('white');
	return;
    }
    return this.whiteDeck.shift();
}

Game.prototype.updateBlackCard = function() {
    // Check if we have cards in the black deck, if not we'll just return. 
    // We only do the broadcasting once, and that's done when we check after we remove a card.
    if (this.blackDeck.length <= 0) {
	return;
    }
    if (this.blackDeck.length > 0) {
	var black =  this.blackDeck.shift();
	this.broadcast('newBlack', {
	    desc: black.desc,
	    action: black.action,
	    remaining: this.blackDeck.length
	});
    }
}

Game.prototype.nextRound = function() {
    this.submittedWhites = [];
    this.updateBlackCard();
    this.updateTzar();
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
	players: this.getPlayerData(),
	myIdx: playerIdx
    });
}

Game.prototype.select = function(playerIdx, card) {
    console.log("player " + playerIdx + " selected card " + card);
    if (playerIdx !== this.tzarIdx) {
	console.log("!!!!!!!!!!!!!the tzaridx and the player who selected the card isn't the same!");
    }
    var winnerIdx;
    for (var i = 0; i < this.submittedWhites.length; i++) {
	var whiteCard = this.submittedWhites[i];
	if (whiteCard.desc == card) {
	    winnerIdx = whiteCard.playerIdx;
	    break;
	}
    }
    var winner = this.players[winnerIdx];
    winner.score += 1;
    this.broadcast('score', {
	score: winner.score,
	playerIdx: winnerIdx
    });
    this.nextRound();
}

Game.prototype.submit = function(playerIdx, cardDesc) {
    var player = this.players[playerIdx];
    for (var i = 0; i < player.hand.length; i++) {
	var handCard = player.hand[i];
	if (null !== handCard && handCard.desc === cardDesc) {
	    handCard.playerIdx = playerIdx;
	    this.submittedWhites.push(handCard);u
	    player.hand[i] = null;
	    break;
	}
    }
    this.fixPlayerHand(playerIdx);
}

Game.prototype.start = function() {
    console.log("starting the game.");
    for (var i = 0; i < this.players.length; i++) {
	var player = this.players[i];
	if (!this.isActivePlayer(player)) {
	    continue;
	}
	this.fixPlayerHand(i);
    }
    this.nextRound();
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