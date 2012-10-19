var socket
, adminIdx
, myIdx
, tzarIdx
, lastMsg
, blacksRemaining
, hand = []
, handElem = []
, gameStarted = false
, playersRequired = 100
, submission
, submittedCards
, submittedElem = []
, selected
, SERVER_EVENTS = ['initPlayer', 'join', 'leave', 'rejoin', 'gameHash', 'remaining', 'admin', 'score', 'newHand', 'round', 'white', 'submitted', 'allsubmitted', 'gameover', 'msg'];

// This will be the main function that will be called after loading client.js. 
// Needs to create the socket connection via Socket.io.
function startGame() {
    socket = io.connect();

    socket.on('connect', function() {
	$('#announcement').html('<h1>Connected!</h1>');
	setTimeout(function() {
	    initializeGame();
	}, 1000);
    });

    // Find out what this window parameter is
    SERVER_EVENTS.forEach(function(event) {
	socket.on(event, window[event]);
    });

    $('#input').focus();
    $('#input').keydown(input);
    $('#share').bind('mouseup', function(event) {
	$('#share input')[0].select();
	event.stopImmediatePropagation();
	return false;
    });
    $('#start').click(start);
    $('#submit').click(submit);
    $('#select').click(select);
}

function initializeGame() {
    var sess = getCookie('sess') || randString(10);
    // Set the cookie for an hour.
    setCookie('sess', sess, 1.0/24);
    var msg = {sess: sess};
    var hash = window.location.hash;
    if (hash) {
	hash = hash.substring(hash.indexOf('#!/') + 3);
	msg.hash = hash;
	$('#share input').attr('value', window.location.href);
    }
    socket.emit('initialize', msg);
}

function input(e) {
    e = e || event;
    var self = this;
    if (e.which === 13) {
	if (!e.ctrlKey) {
	    socket.emit('chat', this.value);
	    this.value = "";
	} else {
	    this.value += "\n";
	}
	e.preventDefault();
    }
    setTimeout(function() {
	if (self.value) $(self).prev().fadeOut('fast');
	else $(self).prev().fadeIn('fast');
    }, 15);
}

function msg(obj) {
    var skipPlayer = obj.event !== undefined;
    if (lastMsg && !obj.event && obj.player === lastMsg.player) {
	skipPlayer = true;
    }
    var m = $('<li>' +
	      (skipPlayer ?
	       '' :
	       '<h3 class="p' + obj.player +
	       '">Player ' +(obj.player+1) + '</h3>') +
	      '<div class="message cornered ' + (obj.event ? '' : 'player-message') + '">' +
	      obj.msg + '</div></li>'
	     );
    lastMsg = {player: obj.player, event: obj.event};
    $('#chatwrap').append(m);
    
    $('html, body').stop();
    $('html, body').animate({ scrollTop: $(document).height() }, 200);
}

function start(event) {
    gameStarted = true;
    $('#start').hide(500);    
    socket.emit('start');
    event.preventDefault();
}

function submit(event) {
    if (noCardChosen(submission)) {
	return;
    }
    $('#submit').fadeOut();
    socket.emit('submit', {
	desc: submission
    });
    event.preventDefault();
}

function select(event) {
    if (noCardChosen(selected)) {
	return;
    }
    $('#select').fadeOut();
    socket.emit('select', {
	desc: selected
    });
    event.preventDefault();
}

function noCardChosen(card) {
    if (null === card) {
	$('#announcement').html("<h1>You need to select a card.</h1>");
	defaultAnnouncement(3000);
	return true;
    }
    return false;
}

function initPlayer(data) {
    gameStarted = data.started;
    if ('myIdx' in data) {
	myIdx = data.myIdx;
    }
    if ('tzarIdx' in data) {
	tzarIdx = data.tzarIdx;
    }
    if (gameStarted) {
	if ('hand' in data) {
	    updateAndDisplayHand(data.hand);
	}
	handleStartButton();
	round(data, true);
    }
    if (!gameStarted && 'remaining' in data) {
	remaining(data.remaining);
    }
    if ('adminIdx' in data) {
	admin(data.adminIdx);
    }
    if ('players' in data) {
	updatePlayers(data.players);
    }
    $('#sharewrap, #chatwrap').css({display:'block'});
}

function updatePlayers(players) {
    for (var i in players) {
	var playerDiv = $('#p' + i);
	if ('score' in players[i]) {
	    playerDiv.children('h2').text('' + players[i].score);
	}
	if ('online' in players[i]) {
	    if (players[i].online) {
		playerDiv.children('.offline').fadeOut(1000);
	    } else {
		playerDiv.children('.offline').fadeIn(1000);
	    }
	}
	playerDiv.slideDown();
    }
}

function join(playerIdx) {
    var players = {};
    players[playerIdx] = {score: 0, online: true};
    updatePlayers(players);
}

function leave(playerIdx) {
    var players = {};
    players[playerIdx] = {online: false};
    updatePlayers(players);
}

function rejoin(playerIdx) {
    var players = {};
    players[playerIdx] = {online: true};
    updatePlayers(players);
}

// This is the hash of the game.
// For example, the url to a game will be www.cah.com/game/#!/123AB and 123AB will be the hash of the game.
// We'll have to update the url address with this hash.
// We also will have a text box somewhere that says 'share this url to invite' and we'll have to update
// that textbox with the right url.
function gameHash(hash) {
    window.location.replace(window.location.href.split('#')[0] + '#!/' + hash);
    $('#share input').attr('value', window.location.href);
}

// This is a function to update the number of remaining players needed to start a game.
function remaining(num) {
    playersRequired = num;
    if (playersRequired > 0) {
	$('#announcement').html("<h1>Waiting to start</h1> Need " + playersRequired + " more players");
    } else if (playersRequired <= 0) {
	$('#announcement').html("<h1>Waiting to start</h1> Player " + (adminIdx + 1) + " should press start to start the game.");
    }
    handleStartButton();
}

// Visual update of who the new admin is.
function admin(newAdminIdx) {
    adminIdx = newAdminIdx;
    handleStartButton();
}

function round(data, dontEmpty) {
    roundTimer(5);
    gameStarted = true;
    setTimeout(function() {
	$('#blackcard').fadeIn();
	$('#hand').fadeIn();
	$('#submitted').fadeIn();
	if (!dontEmpty) {
	    $('#submitted').children('.cards').empty();
	}
	if ('tzarIdx' in data) {
	    tzarIdx = data.tzarIdx;
	    handleTzar();
	}
	if ('blacks' in data) {
	    blacksRemaining = data.blacks;
	}
	if ('desc' in data) {
	    $('#blackcard').children('.cardText').html(data.desc);
	}
    }, 5000);
}

function roundTimer(seconds) {
    $('#announcement').html("<h1>Round loading in " + seconds + "...</h1>");
    if (seconds > 0) {
	setTimeout(function () {
	    roundTimer(seconds-1);
	}, 1000);
    } else {
	defaultAnnouncement(0);
    }
}

function handleTzar() {
    var tzarOverlay = $('#hand').children('.tzar');
    if (myIdx !== tzarIdx) {
	$('#submit').fadeIn();
	tzarOverlay.fadeOut();
    } else {
	tzarOverlay.fadeIn();
    }
    
    for (var i = 0; i < 8; i++) {
	var player = '#p' + i;
	if (i === tzarIdx) {
	    $(player).children('.tzar').fadeIn();
	} else {
	    $(player).children('.tzar').fadeOut();
	}
    }
}

function defaultAnnouncement(time) {
    setTimeout(function() {
	$('#announcement').html("<h2>Black Cards Left: " + blacksRemaining + " </h2>");
    }, time);
}

function resetScores() {
    for (var i = 0; i < 8; i++) {
	var player = $('#p' + i);
	player.children('h2').text("0");
    }
}

function score(data) {
    if ('score' in data && 'playerIdx' in data) {
	var player = $('#p' + data.playerIdx);
	player.children('h2').text(data.score);
    }
    if ('card' in data) {
	var cardIdx;
	for (var i = 0; i < submittedCards.length; i++) {
	    if (submittedCards[i].desc === data.card) {
		cardIdx = i;
		break;
	    }
	}
	submittedElem[cardIdx].addClass('won');
    }
}

// Inside data is the playerIdx and the white cards that this playerIdx will hold.
// Update the visuals with the cards.
function newHand(data) {
    if ('playerIdx' in data && 'hand' in data && data.playerIdx === myIdx) {
	updateAndDisplayHand(data.hand);
    }
}

function gameover() {
    gameStarted = false;
    $('#blackcard').fadeOut();
    $('#hand').fadeOut();
    $('#submitted').fadeOut();
    $('#announcement').html("<h1>Game over!</h1>Player " + (adminIdx+1) + " can hit start to play again");
    handleStartButton();
}

function handleStartButton() {
    if (gameStarted) {
	$('#start').fadeOut();
	return;
    }
    if (myIdx !== adminIdx) {
	$('#start').fadeOut();
	return;
    }
    if (playersRequired > 0) {
	$('#start').fadeOut();
	return;
    }
    $('#start').fadeIn();
}

function updateAndDisplayHand(newHand) {
    hand = newHand;
    handElem = [];
    submission = null;
    var handCardArea = $('#hand').children('.cards');
    handCardArea.empty()
    
    $.each(newHand, function(idx, card) {
	var c = $('<div/>', {
	    'class': 'cardText white'
	});
	c.append(card.desc);
	var cardwrap = $('<div/>', {
	    'class': 'whitecard',
	    mousedown: function() {
		submitCard(this, handElem, hand);
	    }
	});
	cardwrap.append(c);
	handElem.push(cardwrap);
	handCardArea.append(cardwrap);
    });
}

function allsubmitted(data) {
    submittedCards = data.submitted;
    submittedElem = [];
    selected = null;
    var cardArea = $('#submitted').children('.cards');
    cardArea.empty();
    if (tzarIdx === myIdx) {
	$('#select').fadeIn();
    }
    $.each(submittedCards, function(idx, card) {
	var c = $('<div/>', {
	    'class': 'cardText white'
	});
	c.append(card.desc);
	var cardwrap = $('<div/>', {
	    'class': 'whitecard',
	    mousedown: function() {
		selectCard(this, submittedElem, submittedCards);
	    }
	});
	cardwrap.append(c);
	submittedElem.push(cardwrap);
	cardArea.append(cardwrap);
    });
}

function submitCard(elem, elemArray, cardArray) {
    var idx = elemArray.map(function(v) {
	return v[0];
    }).indexOf(elem);
    for (var i = 0; i < cardArray.length; i++) {
	if (idx === i) {
	    elemArray[i].addClass('selected');
	    submission = cardArray[i].desc;
	} else {
	    elemArray[i].removeClass('selected');
	}
    }
}

function selectCard(elem, elemArray, cardArray) {
    var idx = elemArray.map(function(v) {
	return v[0];
    }).indexOf(elem);
    for (var i = 0; i < cardArray.length; i++) {
	if (idx === i) {
	    elemArray[i].addClass('selected');
	    selected = cardArray[i].desc;
	} else {
	    elemArray[i].removeClass('selected');
	}
    }
}

function submitted(numOfSubmittedCards) {
    var cardArea = $('#submitted').children('.cards');
    cardArea.empty();
    for (var i = 0; i < numOfSubmittedCards; i++) {
	cardArea.append("<div class = \"whitecard\"></div>");
    }
}

function getCookie(name) {
  var nameEQ = name + "=";
  var ca = document.cookie.split(';');
  for(var i=0;i < ca.length;i++) {
    var c = ca[i];
    while (c.charAt(0)==' ') c = c.substring(1,c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
  }
  return null;
}

function setCookie(name,value,days) {
  if (days) {
    var date = new Date();
    date.setTime(date.getTime()+(days*24*60*60*1000));
    var expires = "; expires="+date.toGMTString();
  }
  else var expires = "";
  document.cookie = name+"="+value+expires+"; path=/";
}

var CHARSET = ['2','3','4','6','7','9','A','C','D','E','F','G','H','J','K','L','M','N','P','Q','R',
              'T','V','W','X','Y','Z'];

function randString(size) {
  var ret = "";
  while (size-- > 0) {
    ret += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return ret;
}