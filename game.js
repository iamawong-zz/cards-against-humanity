var CLIENT_EVENTS = ['init', 'chat', 'select', 'submit', 'start'];

var Game = function(socket, hash) {
    this.socket = socket;
    this.players = [null, null, null, null, null, null, null, null, null, null];
    this.hash = hash;
    this.gameAdminIdx = 0;
    this.messages = [];
    this.blackDeck = [];
    this.whiteDeck = [];
    this.black = "";

    this.started = false;
}

Game.prototype.resetDeck = function() {
    this.blackDeck = this.getBlackDeck();
    this.whiteDeck = this.getWhiteDeck();

    shuffle(this.blackDeck);
    shuffle(this.whiteDeck);
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
    if (this.messages.length > 4) this.messages.shift();
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
    this.reset();
    this.started = true;
    for (var i = 0; i < this.players.length; i++) {
	var player = this.players[i];
	if (!this.isActivePlayer(player)) {
	    continue;
	}
	this.fixPlayerHand(i);
    }
    this.nextRound();
}

Game.prototype.getBlackDeck = function() {
    // Need to implement
    return [new BlackCard("How did I lose my virginity?", 1),
	    new BlackCard("Why can't I sleep at night?", 1),
	    new BlackCard("What's that smell?", 1),
	    new BlackCard("I got 99 problems but _____ ain't one.", 1),
	    new BlackCard("Maybe she's born with it. Maybe it's _____.", 1),
	    new BlackCard("What's the next Happy Meal toy?", 1),
	    new BlackCard("Here is the church. Here is the steeple. Open the doors and there is _____.", 1),
	    new BlackCard("It's a pity that kids these days are all getting involved with _____.", 1),
	    new BlackCard("During his childhood, Salvador Dali produced hundreds of paintings of _____.", 1),
	    new BlackCard("Alternative medicine is now embracing the curative powers of _____.", 1),
	    new BlackCard("What's that sound?", 1),
	    new BlackCard("What ended my last relationship?", 1),
	    new BlackCard("MTV's new reality show features eight washed-up celebrities living with _____.", 1),
	    new BlackCard("I drink to forget _____.", 1),
	    new BlackCard("I'm sorry, Professor, but I couldn't complete my homework because of _____.", 1),
	    new BlackCard("What is Batman's guilty pleasure?", 1),
	    new BlackCard("This is the way the world ends\ This is the way the world ends\ Not with a bang but with _____.", 1),
	    new BlackCard("What's a girl's best friend?", 1),
	    new BlackCard("TSA guidelines now prohibit _____ on airplanes.", 1),
	    new BlackCard("_____. That's how I want to die.", 1),
	    new BlackCard("In the new Disney Channel Original Movie, Hannah Montana struggles with _____ for the first time.", 1),
	    new BlackCard("What does Dick Cheney prefer?", 1),
	    new BlackCard("Dear Abby, I'm having some trouble with _____ and would like your advice.", 1),
	    new BlackCard("Instead of coals, Santa now gives the bad children _____.", 1),
	    new BlackCard("What's the most emo?", 1),
	    new BlackCard("In 1,000 years, when paper money is a distant memory, how will we pay for goods and services?", 1),
	    new BlackCard("A romantic candlelit dinner would be incomplete without _____.", 1),
	    new BlackCard("_____. Betcha can't have just one!", 1),
	    new BlackCard("White people like _____.", 1),
	    new BlackCard("_____. High five, bro.", 1),
	    new BlackCard("Next from J.K. Rowling: Harry Potter and the Chamber of _____.", 1),
	    new BlackCard("BILLY MAYS HERE FOR _____.", 1),
	    new BlackCard("War! What is it good for?", 1),
	    new BlackCard("During sex, I like to think about _____.", 1),
	    new BlackCard("What are my parents hiding from me?", 1),
	    new BlackCard("What will always get you laid?", 1),
	    new BlackCard("In L.A. County Jail, word is you can trade 200 cigarettes for _____.", 1),
	    new BlackCard("What did I bring back from Mexico?", 1),
	    new BlackCard("What don't you want to find in your Chinese food?", 1),
	    new BlackCard("What will I bring back in time to convince people that I am a powerful wizard?", 1),
	    new BlackCard("How am I maintaining my relationship status?", 1),
	    new BlackCard("_____. It's a trap!", 1),
	    new BlackCard("Coming to Broadway this season, _____: The Musical.", 1),
	    new BlackCard("When the U.S. raced the Soviets to the moon, the Mexican government funneled millions of pesos into research on _____.", 1),
	    new BlackCard("After the earthquake, Sean Penn brought _____ to the people of Haiti.", 1),
	    new BlackCard("Next on ESPN2, the World Series of _____.", 1),
	    new BlackCard("But before I kill you, Mr. Bond, I must show you _____.", 1),
	    new BlackCard("What gives me uncontrollable gas?", 1),
	    new BlackCard("What do old people smell like?", 1),
	    new BlackCard("The class field trip was completely ruined by _____.", 1),
	    new BlackCard("When Pharaoh remained unmoved, Moses called down a Plague of _____.", 1),
	    new BlackCard("What's my secret power?", 1),
	    new BlackCard("What's there a ton of in heaven?", 1),
	    new BlackCard("What would grandma find disturbing, yet oddly charming?", 1),
	    new BlackCard("What did the U.S. airdrop to the children of Afghanistan?", 1),
	    new BlackCard("What helps Obama unwind?", 1),
	    new BlackCard("What did Vin Diesel eat for dinner?", 1),
	    new BlackCard("_____: good to the last drop.", 1),
	    new BlackCard("Why am I sticky?", 1),
	    new BlackCard("What gets better with age?", 1),
	    new BlackCard("_____: kid-tested, mother-approved.", 1),
	    new BlackCard("Daddy, why is mommy crying?", 1),
	    new BlackCard("What's Teach for America using to inspire inner city students to succeed?", 1),
	    new BlackCard("Studies show that lab rats navigate mazes 50% faster after being exposed to _____.", 1),
	    new BlackCard("Life for American Indians was forever changed when the White man introduced them to _____.", 1),
	    new BlackCard("I don't know what weapons World War III will be fought, but World War IV will be fought with _____.", 1),
	    new BlackCard("Why do I hurt all over?", 1),
	    new BlackCard("What am I giving up for Lent?", 1),
	    new BlackCard("In Michael Jackson's final moments, he thought about _____.", 1),
	    new BlackCard("The Smithsonian Museum of Natural History has just opened an interactive exhibit on _____.", 1),
	    new BlackCard("When I am President of the United States, I will create the Department of _____.", 1),
	    new BlackCard("When I am a billionaire, I shall erect a 50-foot statue to commemorate _____.", 1),
	    new BlackCard("What's my anti-drug?", 1),
	    new BlackCard("What never fails to liven up the party?", 1),
	    new BlackCard("What's the new fad diet?", 1),
	    new BlackCard("Major League Baseball has banned _____ for giving players an unfair advantage.", 1),
	    new BlackCard("On the eight day, God created _____ and said it was good.", 1)];
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
	    new WhiteCard("Penis envy."),
	    new WhiteCard("Barack Obama."),
	    new WhiteCard("My humps."),
	    new WhiteCard("The Tempur-pedic Swedish Sleep System."),
	    new WhiteCard("Scientology."),
	    new WhiteCard("Dry heaving."),
	    new WhiteCard("Skeletor."),
	    new WhiteCard("Darth Vader."),
	    new WhiteCard("Figgy pudding."),
	    new WhiteCard("Chutzpah."),
	    new WhiteCard("Five-Dollar Footlongs."),
	    new WhiteCard("Elderly Japanese Men."),
	    new WhiteCard("Free Samples."),
	    new WhiteCard("Estrogen."),
	    new WhiteCard("Sexual tension."),
	    new WhiteCard("Famine."),
	    new WhiteCard("A stray pube."),
	    new WhiteCard("Men."),
	    new WhiteCard("Heartwarming orphans."),
	    new WhiteCard("Genital piercings."),
	    new WhiteCard("A bag of magic beans."),
	    new WhiteCard("Repression."),
	    new WhiteCard("Prancing."),
	    new WhiteCard("My relationship status."),
	    new WhiteCard("Overcompensation."),
	    new WhiteCard("Peeing a little bit."),
	    new WhiteCard("Pooping back and forth. Forever."),
	    new WhiteCard("Eating all of the cookies before the AIDS bake sale."),
	    new WhiteCard("Testicular torsion."),
	    new WhiteCard("The Devil himself."),
	    new WhiteCard("The World of Warcraft."),
	    new WhiteCard("Dick Cheney."),
	    new WhiteCard("MechaHitler."),
	    new WhiteCard("Being fabulous."),
	    new WhiteCard("Pictures of boobs."),
	    new WhiteCard("A caress of the inner thigh."),
	    new WhiteCard("The Amish."),
	    new WhiteCard("Pabst Blue Ribbon."),
	    new WhiteCard("Lance Armstrong's missing testicle."),
	    new WhiteCard("Pedophiles."),
	    new WhiteCard("The Pope."),
	    new WhiteCard("Flying sex snakes."),
	    new WhiteCard("Sarah Palin."),
	    new WhiteCard("Feeding Rosie O'Donnell."),
	    new WhiteCard("Sexy pillow fights."),
	    new WhiteCard("Another goddamn vampire movie."),
	    new WhiteCard("Cybernetic enhancements."),
	    new WhiteCard("Civilian casualities."),
	    new WhiteCard("Scrubbing under the folds."),
	    new WhiteCard("The female orgasm."),
	    new WhiteCard("Bitches."),
	    new WhiteCard("The Boy Scouts of America."),
	    new WhiteCard("Auschwitz."),
	    new WhiteCard("Finger painting."),
	    new WhiteCard("The Care Bear Stare."),
	    new WhiteCard("The Jews."),
	    new WhiteCard("Being marginialized."),
	    new WhiteCard("The Blood of Christ."),
	    new WhiteCard("Dead parents."),
	    new WhiteCard("Seduction."),
	    new WhiteCard("Dying of dysentery."),
	    new WhiteCard("Mr Clean, right behind you."),
	    new WhiteCard("The Virginia Tech Massacre."),
	    new WhiteCard("Jewish fraternities."),
	    new WhiteCard("Hot Pockets."),
	    new WhiteCard("Natalie Portman."),
	    new WhiteCard("Agriculture."),
	    new WhiteCard("Judge Judy."),
	    new WhiteCard("Surprised sex!"),
	    new WhiteCard("The homosexual lifestyle."),
	    new WhiteCard("Robert Downey, Jr."),
	    new WhiteCard("The Trail of Tears."),
	    new WhiteCard("An M. Night Shyamalan plot twist."),
	    new WhiteCard("A big hoopla about nothing."),
	    new WhiteCard("Electricity."),
	    new WhiteCard("Amputees."),
	    new WhiteCard("Throwing a virgin into a volcano."),
	    new WhiteCard("Italians."),
	    new WhiteCard("Explosions."),
	    new WhiteCard("A good sniff."),
	    new WhiteCard("Destroying the evidence."),
	    new WhiteCard("Children on leashes."),
	    new WhiteCard("Catapults."),
	    new WhiteCard("One trillion dollars."),
	    new WhiteCard("Friends with benefits."),
	    new WhiteCard("Dying."),
	    new WhiteCard("Silence."),
	    new WhiteCard("An honest cop with nothing left to lose."),
	    new WhiteCard("YOU MUST CONSTRUCT ADDITIONAL PYLONS."),
	    new WhiteCard("Justin Bieber."),
	    new WhiteCard("The Holy Bible."),
	    new WhiteCard("Balls."),
	    new WhiteCard("Praying the gay away."),
	    new WhiteCard("Teenage pregnancy."),
	    new WhiteCard("German dungeon porn."),
	    new WhiteCard("The invisible hand."),
	    new WhiteCard("My inner demons."),
	    new WhiteCard("Powerful thighs."),
	    new WhiteCard("Getting naked and watching Nickelodeon."),
	    new WhiteCard("Crippling debt."),
	    new WhiteCard("Kamikaze pilots."),
	    new WhiteCard("Teaching a robot to love."),
	    new WhiteCard("Police brutality."),
	    new WhiteCard("Horse meat."),
	    new WhiteCard("All you can eat shrimp for $4.99."),
	    new WhiteCard("Heteronormativity."),
	    new WhiteCard("Michael Jackson."),
	    new WhiteCard("A really cool hat."),
	    new WhiteCard("Copping a feel."),
	    new WhiteCard("Crystal meth."),
	    new WhiteCard("Shapeshifters."),
	    new WhiteCard("Fingering."),
	    new WhiteCard("A disappointing birthday party."),
	    new WhiteCard("Dental dams."),
	    new WhiteCard("My soul."),
	    new WhiteCard("A sausage festival."),
	    new WhiteCard("The chronic."),
	    new WhiteCard("Eugenics."),
	    new WhiteCard("Synergistic management solutions."),
	    new WhiteCard("RoboCop."),
	    new WhiteCard("Serfdom."),
	    new WhiteCard("Stephen Hawking talking dirty."),
	    new WhiteCard("Tangled Slinkys."),
	    new WhiteCard("Fiery poops."),
	    new WhiteCard("Public ridicule."),
	    new WhiteCard("That thing that electrocutes your abs."),
	    new WhiteCard("Picking up girls at the abortion clinic."),
	    new WhiteCard("Object permanence."),
	    new WhiteCard("GoGurt."),
	    new WhiteCard("Lockjaw."),
	    new WhiteCard("Attitude."),
	    new WhiteCard("Passable transvestites."),
	    new WhiteCard("Wet dreams."),
	    new WhiteCard("The Dance of the Sugar Plum Fairy."),
	    new WhiteCard("Firing a rifle into the air while balls deep in a squealing hog."),
	    new WhiteCard("Panda Sex."),
	    new WhiteCard("Necrophilia."),
	    new WhiteCard("Grave robbing."),
	    new WhiteCard("A bleached asshole."),
	    new WhiteCard("Muhammad (Praise Be Unto Him)."),
	    new WhiteCard("Multiple stab wounds."),
	    new WhiteCard("Stranger danger."),
	    new WhiteCard("A monkey smoking a cigar."),
	    new WhiteCard("Smegma."),
	    new WhiteCard("A live studio audience."),
	    new WhiteCard("Making a pouty face."),
	    new WhiteCard("The violation of our most basic human rights."),
	    new WhiteCard("Unfathomable stupidity."),
	    new WhiteCard("Sunshine and rainbows."),
	    new WhiteCard("Whipping it out."),
	    new WhiteCard("The token minority."),
	    new WhiteCard("The terrorists."),
	    new WhiteCard("The Three-Fifths compromise."),
	    new WhiteCard("A snapping turtle biting the tip of your penis."),
	    new WhiteCard("Vehicular manslaughter."),
	    new WhiteCard("Jibber-jabber."),
	    new WhiteCard("Emotions."),
	    new WhiteCard("Getting so angry that you pop a boner."),
	    new WhiteCard("Same-sex ice dancing."),
	    new WhiteCard("An M16 assault rifle."),
	    new WhiteCard("Man meat."),
	    new WhiteCard("Incest."),
	    new WhiteCard("A foul mouth."),
	    new WhiteCard("Flightless birds."),
	    new WhiteCard("Doing the right thing."),
	    new WhiteCard("When you fart and a little bit comes out."),
	    new WhiteCard("Frolicking."),
	    new WhiteCard("Being a dick to children."),
	    new WhiteCard("Poopy diapers."),
	    new WhiteCard("Filing Sean Hannity with helium and watching him float away."),
	    new WhiteCard("Raptor attacks."),
	    new WhiteCard("Swooping."),
	    new WhiteCard("Concealing a boner."),
	    new WhiteCard("Full frontal nudity."),
	    new WhiteCard("Vigorous jazz hands."),
	    new WhiteCard("Nipple blades."),
	    new WhiteCard("A bitch slap."),
	    new WhiteCard("Michelle Obama's arms."),
	    new WhiteCard("Mouth herpes."),
	    new WhiteCard("A robust mongoloid."),
	    new WhiteCard("Mutually-assured destruction."),
	    new WhiteCard("The rapture."),
	    new WhiteCard("Road head."),
	    new WhiteCard("Stalin."),
	    new WhiteCard("Lactation."),
	    new WhiteCard("Hurricane Katrina."),
	    new WhiteCard("The true meaning of Christmas."),
	    new WhiteCard("Self-loathing."),
	    new WhiteCard("A brain tumor."),
	    new WhiteCard("Dead babies."),
	    new WhiteCard("New Age music."),
	    new WhiteCard("A thermonuclear detonation."),
	    new WhiteCard("Geese."),
	    new WhiteCard("Kanye West."),
	    new WhiteCard("God."),
	    new WhiteCard("A spastic nerd."),
	    new WhiteCard("Harry Potter erotica."),
	    new WhiteCard("Kids with ass cancer."),
	    new WhiteCard("Lumberjack fantasies."),
	    new WhiteCard("The American Dream."),
	    new WhiteCard("Puberty."),
	    new WhiteCard("Sweet, sweet vengeance."),
	    new WhiteCard("Winking at old people."),
	    new WhiteCard("The taint; the grundle; the fleshy fun-bridge."),
	    new WhiteCard("Oompa - Loopmas."),
	    new WhiteCard("Authentic Mexican cusine."),
	    new WhiteCard("Preteens."),
	    new WhiteCard("The Little Engine That Could."),
	    new WhiteCard("Guys who don't call."),
	    new WhiteCard("Erectile dysfunction."),
	    new WhiteCard("Parting the Red Sea."),
	    new WhiteCard("Rush Limbaugh's soft, shitty body."),
	    new WhiteCard("Saxophone solos."),
	    new WhiteCard("Land mines."),
	    new WhiteCard("Capturing Newt Gingrich and forcing him to dance in a monkey suit."),
	    new WhiteCard("Me time."),
	    new WhiteCard("Nickelback."),
	    new WhiteCard("Vigilante justice."),
	    new WhiteCard("The South."),
	    new WhiteCard("Opposable thumbs."),
	    new WhiteCard("Ghosts."),
	    new WhiteCard("Alcoholism."),
	    new WhiteCard("Poorly-timed Holocaust jokes."),
	    new WhiteCard("Inappropriate yodeling."),
	    new WhiteCard("Battlefield amputations."),
	    new WhiteCard("Exactly what you'd expect."),
	    new WhiteCard("A time travel paradox."),
	    new WhiteCard("AXE Body Spray."),
	    new WhiteCard("Actually taking candy from a baby."),
	    new WhiteCard("Leaving an awkward voicemail."),
	    new WhiteCard("A sassy black woman."),
	    new WhiteCard("Being a motherfucking sorcerer."),
	    new WhiteCard("A mopey zoo lion."),
	    new WhiteCard("A murder most foul."),
	    new WhiteCard("A falcon with a cap on its head."),
	    new WhiteCard("Farting and walking away."),
	    new WhiteCard("A mating display."),
	    new WhiteCard("The Chinese gymnastics team."),
	    new WhiteCard("Friction."),
	    new WhiteCard("Asians who aren't good at math."),
	    new WhiteCard("Fear itself."),
	    new WhiteCard("A can of whoop-ass."),
	    new WhiteCard("Yeast."),
	    new WhiteCard("Lunchables."),
	    new WhiteCard("Licking things to claim them as your own."),
	    new WhiteCard("Vikings."),
	    new WhiteCard("The Kool-Aid Man."),
	    new WhiteCard("Hot cheese."),
	    new WhiteCard("Nicholas Cage."),
	    new WhiteCard("A defective condom."),
	    new WhiteCard("The inevitable heat death of the universe."),
	    new WhiteCard("Republicans."),
	    new WhiteCard("William Shatner."),
	    new WhiteCard("Tentacle porn."),
	    new WhiteCard("Sperm whales."),
	    new WhiteCard("Lady Gaga."),
	    new WhiteCard("Chunks of dead prostitutes."),
	    new WhiteCard("Gloryholes."),
	    new WhiteCard("Daddy issues."),
	    new WhiteCard("A mime having a stroke."),
	    new WhiteCard("White people."),
	    new WhiteCard("A lifetime of sadness."),
	    new WhiteCard("Tasteful sideboob."),
	    new WhiteCard("A sea of troubles."),
	    new WhiteCard("Nazis."),
	    new WhiteCard("A cooler full of organs."),
	    new WhiteCard("Giving 110%."),
	    new WhiteCard("Doin' it in the butt."),
	    new WhiteCard("John Wilkes Booth."),
	    new WhiteCard("Obesity."),
	    new WhiteCard("A homoerotic volleyball montage."),
	    new WhiteCard("Puppies."),
	    new WhiteCard("Natural male enhancement."),
	    new WhiteCard("Brown people."),
	    new WhiteCard("Dropping a chandelier on your enemies and riding the rope up."),
	    new WhiteCard("Soup that is too hot."),
	    new WhiteCard("Porn stars."),
	    new WhiteCard("Hormone injections."),
	    new WhiteCard("Pulling out."),
	    new WhiteCard("The Big Bang."),
	    new WhiteCard("Switching to Geico."),
	    new WhiteCard("Wearing underwear inside-out to avoid doing laundry."),
	    new WhiteCard("Rehab."),
	    new WhiteCard("Christopher Walken."),
	    new WhiteCard("Count Chocula."),
	    new WhiteCard("The Hamburglar."),
	    new WhiteCard("Not reciprocating oral sex."),
	    new WhiteCard("Aaron Burr."),
	    new WhiteCard("Hot people."),
	    new WhiteCard("Foreskin."),
	    new WhiteCard("Assless chaps."),
	    new WhiteCard("The miracle of childbirth."),
	    new WhiteCard("Waiting 'til marriage."),
	    new WhiteCard("Two midgets shitting in a bucket."),
	    new WhiteCard("Adderall."),
	    new WhiteCard("A sad handjob."),
	    new WhiteCard("Cheating in the Special Olympics."),
	    new WhiteCard("The glass ceiling."),
	    new WhiteCard("The hustle."),
	    new WhiteCard("Getting drunk on mouthwash."),
	    new WhiteCard("Bling."),
	    new WhiteCard("Breaking out into song and dance."),
	    new WhiteCard("A super Soaker full of cat pee."),
	    new WhiteCard("The underground Railroad."),
	    new WhiteCard("Home video of Oprah sobbing into a Lean Cuisine."),
	    new WhiteCard("The Rev. Dr. Martin Luther King Jr."),
	    new WhiteCard("Extremely tight pants."),
	    new WhiteCard("Third base."),
	    new WhiteCard("Waking up half-naked in a Denny's parking lot."),
	    new WhiteCard("Golden showers."),
	    new WhiteCard("White privilege."),
	    new WhiteCard("Hope."),
	    new WhiteCard("Taking off your shirt."),
	    new WhiteCard("Smallpox blankets."),
	    new WhiteCard("Ethnic cleansing."),
	    new WhiteCard("Queefing."),
	    new WhiteCard("Helplessly giggling at the mention of Hutus and Tutsis."),
	    new WhiteCard("Getting really high."),
	    new WhiteCard("Natural selection."),
	    new WhiteCard("A gassy antelope."),
	    new WhiteCard("My sex life."),
	    new WhiteCard("Arnold Schwarzenegger."),
	    new WhiteCard("Pretending to care."),
	    new WhiteCard("Ronald Reagan."),
	    new WhiteCard("Toni Morrison's vagina."),
	    new WhiteCard("Pterodactyl eggs."),
	    new WhiteCard("A death ray."),
	    new WhiteCard("BATMAN!!!"),
	    new WhiteCard("Homeless people."),
	    new WhiteCard("Racially-biased SAT questions."),
	    new WhiteCard("Centaurs."),
	    new WhiteCard("A salty surprise."),
	    new WhiteCard("72 virgins."),
	    new WhiteCard("Embryonic stem cells."),
	    new WhiteCard("Pixelated bukkake."),
	    new WhiteCard("Seppuku."),
	    new WhiteCard("An icepick lobotomy."),
	    new WhiteCard("Stormtroopers."),
	    new WhiteCard("Menstural rage."),
	    new WhiteCard("Passing a kidney stone."),
	    new WhiteCard("An uppercut."),
	    new WhiteCard("Shaquille O'Neal's acting career."),
	    new WhiteCard("Horrifying laser hair removal accidents."),
	    new WhiteCard("Autocannibalism."),
	    new WhiteCard("A fetus."),
	    new WhiteCard("Riding off into the sunset."),
	    new WhiteCard("Goblins."),
	    new WhiteCard("Eating the last known bison."),
	    new WhiteCard("Shiny objects."),
	    new WhiteCard("Being rich."),
	    new WhiteCard("A Bop It."),
	    new WhiteCard("Leprosy."),
	    new WhiteCard("World peace."),
	    new WhiteCard("Dick fingers."),
	    new WhiteCard("Chainsaw for hands."),
	    new WhiteCard("The Make-A-Wish Foundation."),
	    new WhiteCard("Britney Spears at 55."),
	    new WhiteCard("Laying an egg."),
	    new WhiteCard("The folly of man."),
	    new WhiteCard("My genitals."),
	    new WhiteCard("Grandma."),
	    new WhiteCard("Flesh-eating bacteria."),
	    new WhiteCard("Poor people."),
	    new WhiteCard("50,000 volts straight to the nipples."),
	    new WhiteCard("Active listening."),
	    new WhiteCard("The Ubermensch."),
	    new WhiteCard("Poor life choices."),
	    new WhiteCard("Alter boys."),
	    new WhiteCard("My vagina."),
	    new WhiteCard("Pac-Man uncontrollably guzzling cum."),
	    new WhiteCard("Sniffing glue."),
	    new WhiteCard("The placenta."),
	    new WhiteCard("The profoundly handicapped."),
	    new WhiteCard("Spontaneous human combustion."),
	    new WhiteCard("The KKK."),
	    new WhiteCard("The clitoris."),
	    new WhiteCard("Not wearing pants."),
	    new WhiteCard("Date rape."),
	    new WhiteCard("Black people."),
	    new WhiteCard("A bucket of fish heads."),
	    new WhiteCard("Hospice care."),
	    new WhiteCard("Passive-aggressive Post-it notes."),
	    new WhiteCard("Fancy Feast."),
	    new WhiteCard("The heart of a child."),
	    new WhiteCard("Sharing needles."),
	    new WhiteCard("Scalping."),
	    new WhiteCard("A look-see."),
	    new WhiteCard("Getting married, having a few kids, buying some stuff, retiring, and dying."),
	    new WhiteCard("Sean Penn."),
	    new WhiteCard("Sean Connery."),
	    new WhiteCard("Expecting a burp and vomiting on the floor."),
	    new WhiteCard("Wifely duties."),
	    new WhiteCard("A pyramid of severed heads."),
	    new WhiteCard("Genghis Khan."),
	    new WhiteCard("Historically black colleges."),
	    new WhiteCard("Raping and pillaging."),
	    new WhiteCard("A subscription to Men's Fitness."),
	    new WhiteCard("The milk man."),
	    new WhiteCard("Friendly fire."),
	    new WhiteCard("Women's suffrage."),
	    new WhiteCard("AIDS."),
	    new WhiteCard("Former President George W. Bush."),
	    new WhiteCard("8 oz. of sweet Mexican black-tar heroin."),
	    new WhiteCard("Half-assed foreplay."),
	    new WhiteCard("Edible underpants."),
	    new WhiteCard("My collection of high-tech sex toys."),
	    new WhiteCard("The Forced."),
	    new WhiteCard("Bees?"),
	    new WhiteCard("Loose lips."),
	    new WhiteCard("Jerking off into a pool of children's tears."),
	    new WhiteCard("A micropig wearing a tiny raincoat and booties."),
	    new WhiteCard("A hot mess."),
	    new WhiteCard("Masturbation."),
	    new WhiteCard("Tom Cruise."),
	    new WhiteCard("A balanced breakfast."),
	    new WhiteCard("Anal beads."),
	    new WhiteCard("Drinking alone."),
	    new WhiteCard("Cards Against Humanity."),
	    new WhiteCard("Coat hanger abortions."),
	    new WhiteCard("Used panties."),
	    new WhiteCard("Cuddling."),
	    new WhiteCard("Wiping her butt."),
	    new WhiteCard("Domino's Oreo Dessert Pizza."),
	    new WhiteCard("A zesty breakfast burrito."),
	    new WhiteCard("Morgan Freeman's voice."),
	    new WhiteCard("A middle-aged man on roller skates."),
	    new WhiteCard("Gandhi."),
	    new WhiteCard("The penny whistle solo from \"My Heart Will Go On\"."),
	    new WhiteCard("Spectacular abs."),
	    new WhiteCard("Keanu Reeves."),
	    new WhiteCard("Child beauty pageants."),
	    new WhiteCard("Child abuse."),
	    new WhiteCard("Bill Nye the Science Guy."),
	    new WhiteCard("Science."),
	    new WhiteCard("A tribe of warrior women."),
	    new WhiteCard("Viagra."),
	    new WhiteCard("Her Majesty, Queen Elizabeth II."),
	    new WhiteCard("The entire Mormon Tabernacle Choir."),
	    new WhiteCard("Hulk Hogan."),
	    new WhiteCard("Take-backsies."),
	    new WhiteCard("An erection that lasts longer than four hours.")];
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