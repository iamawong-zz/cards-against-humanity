var socket
, adminIdx
, myIdx
, hand = []
, handElem = []
, gameStarted = false
, submission
, submittedCards
, submittedElem = []
, selected
, SERVER_EVENTS = ['initPlayer', 'join', 'leave', 'rejoin', 'gameHash', 'remaining', 'admin', 'score', 'newHand', 'round', 'white', 'allsubmitted'];

// This will be the main function that will be called after loading client.js. 
// Needs to create the socket connection via Socket.io.
function startGame() {
    socket = io.connect();

    socket.on('connect', function() {
	$('#announcement').html('<h1>Connected!</h1>');
	setTimeout(function() {
	    $('#announcement').fadeOut(function() {
		initializeGame();
	    });
	}, 1000);
    });

    // Find out what this window parameter is
    SERVER_EVENTS.forEach(function(event) {
	socket.on(event, window[event]);
    });

    $('#submit').click(submit);
    $('#start').click(start);
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
    }
    socket.emit('initialize', msg);
}

function start(event) {
    console.log('starting game');
    $('#start').fadeOut(500);
    $('#announcement').fadeOut(500, function() {
	$('#blackcard').fadeIn(10);
	$('#infowrap').fadeIn(10);
	$('#hand').fadeIn(10);
	$('#submitted').fadeIn(10);
    });
    socket.emit('start');
    event.preventDefault();
}

function submit(event) {
    // How do I decide which card is being submitted?
    console.log('submitting');
    console.log(submission);
    if (null === submission) {
	$('#announcement').html("<h1>You need to select a card.</h1>");
	$('#announcement').fadeIn(10, function() {
	    $('#announcement').fadeOut(3000);
	});
	return;
    }
    socket.emit('submit', {
	desc: submission
    });
    var html = "<div class = \"whitecard\"></div>";
    $('#submitted').append(html);
    event.preventDefault();
}

function select(event) {
    console.log('select');
    console.log(selected);
    if (selected === null) {
	$('#announcement').html("<h1>You need to select a card.</h1>");
	$('#announcement').fadeIn(10, function() {
	    $('#announcement').fadeOut(3000);
	});
	return;
    } 
    socket.emit('select', {
	desc: selected
    });
    event.preventDefault();
}

// Initializes the player's view with information. 
// Data is comprised of myIdx and players.
// We then display the player's and their scores in the view.
function initPlayer(data) {
    if ('myIdx' in data) {
	myIdx = data.myIdx;
    }
    if ('adminIdx' in data) {
	admin(data.adminIdx);
    }
    if ('players' in data) {
	updatePlayers(data.players);
    }
    if ('remaining' in data) {
	remaining(data.remaining);
    }
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
    console.log("Here is the hash. " + hash);
}

// This is a function to update the number of remaining players needed to start a game.
function remaining(num) {
    num = 0;
    if (num > 0) {
	$('#announcement').html("<h1>Waiting to start</h1> Need " + num + " more players");
    } else if (num === 0 && myIdx === adminIdx) {
	$('#announcement').html("<h1>Waiting to start</h1> Player " + (adminIdx + 1) + " should press start to start the game.");
    }
	$('#announcement').fadeIn(500);
	$('#start').fadeIn(1000);
}

// Visual update of who the new admin is.
function admin(newAdminIdx) {
    adminIdx = newAdminIdx; 
    if (myIdx === adminIdx && !gameStarted) {
	$('#start').fadeIn(500);
    }
}

function round(data) {
    console.log('round');
    $('#submitted').html("<h2>Submitted Cards</h2>");
    if ('tzarIdx' in data) {
	if (myIdx === data.tzarIdx) {
	    $('#submit').fadeOut(50);
	    $('#select').fadeIn(500);
	} else {
	    $('#submit').fadeIn(500);
	    $('#select').fadeOut(50);
	}
    }
    if ('blacks' in data) {
	$('#blacks').html("Black Cards Remaining: " + data.blacks);
    }
    if ('desc' in data) {
	$('#blackcard').children('.cardText').html(data.desc);
    }
}

function score(data) {
    console.log("updating score for " + data.playerIdx + " with " + data.score);
    if ('score' in data && 'playerIdx' in data) {
	var player = $('#p' + data.playerIdx);
	player.children('h2').text(data.score);
    }
}

// Inside data is the playerIdx and the white cards that this playerIdx will hold.
// Update the visuals with the cards.
function newHand(data) {
    if ('whites' in data) {
	$('#whites').html("White Cards Remaining: " + data.whites);
    }
    if ('playerIdx' in data && 'hand' in data && data.playerIdx === myIdx) {
	updateAndDisplayHand(data.hand);
    }
}

function updateAndDisplayHand(newHand) {
    hand = newHand;
    handElem = [];
    submission = null;
    $('#hand').html("<h2>Your hand</h2>");
    $.each(newHand, function(idx, card) {
	var c = $('<div/>', {
	    'class': 'cardText white'
	});
	c.append(card.desc);
	var cardwrap = $('<div/>', {
	    'class': 'whitecard',
	    mousedown: function() {
		selectCard(this, handElem, hand);
	    }
	});
	cardwrap.append(c);
	handElem.push(cardwrap);
	$('#hand').append(cardwrap);
    });
}

function allsubmitted(data) {
    submittedCards = data.submitted;
    submittedElem = [];
    selected = null;
    $('#submitted').html("<h2>Submitted Cards</h2>");
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
	$('#submitted').append(cardwrap);
    });
}

function selectCard(elem, elemArray, cardArray) {
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

function white() {
    $('#whites').html("Out of white cards!");
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