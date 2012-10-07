var socket
, adminIdx
, tzarIdx
, myIdx
, hand = []
, SERVER_EVENTS = ['initPlayer', 'join', 'leave', 'rejoin', 'gameHash', 'remaining', 'admin', 'tzar', 'score', 'newBlack', 'newHand', 'white'];

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
	}, 1500);
    });

    // Find out what this window parameter is
    SERVER_EVENTS.forEach(function(event) {
	socket.on(event, window[event]);
    });

    $('#submit').click(submit);
    $('#start').click(start);
    $('#select').click(select);
}

function start(event) {
    console.log('starting game');
    // Announce that the game is starting perhaps.
    $('#start').fadeOut(500);
    socket.emit('start');
    event.preventDefault();
}

function submit(event) {
    // How do I decide which card is being submitted?
    console.log('submitting');
    socket.emit('submit', {
	desc: "A micropenis."
    });
    event.preventDefault();
}

function select(event) {
    console.log('select');
    socket.emit('select', {
	desc: "A micropenis."
    });
    event.preventDefault();
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

// Initializes the player's view with information. 
// Data is comprised of myIdx and players.
// We then display the player's and their scores in the view.
function initPlayer(data) {
    if ('myIdx' in data) {
	myIdx = data.myIdx;
	console.log(myIdx);
	console.log(adminIdx);
	if (myIdx === adminIdx) {
	    
	    $('#start').fadeIn(1000);
	}
    }
    if ('players' in data) {
	updatePlayers(data.players);
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

// Updates the client that a player now occupies playerIdx.
// What should happen here is that we show players that there is now a new player with playerIdx. IE player1 or player3
function join(playerIdx) {
    var players = {};
    players[playerIdx] = {score: 0, online: true};
    updatePlayers(players);    
}

// Opposite of leave.
// Remove the div elements that contain this player.
function leave(playerIdx) {
    var players = {};
    players[playerIdx] = {online: false};
    updatePlayers(players);
}

// CUrrently it's the same as join. dont implement yet, maybe we dont need it.
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
    console.log("The number of people remaining is " + num);
}

// Visual update of who the new admin is.
function admin(newAdminIdx) {
    adminIdx = newAdminIdx;
}

// Visual update of who the new tzar is.
function tzar(newTzarIdx) {
    tzarIdx = newTzarIdx;
    console.log("TZARRRRRRRRRRRRRRRRR " + tzarIdx);
}

// Visual update of the score for the user. 
// The input in the data is the playerIdx and their current score.
function score(data) {
}

// Emission that indicates the next will/has started. THe data that comes along is the new black card.
function newBlack(card) {
    $('#blackcard').children('.cardText').html(card.desc);
}

// Inside data is the playerIdx and the white cards that this playerIdx will hold.
// Update the visuals with the cards.
function newHand(data) {
    if (data.playerIdx === myIdx) {
	updateAndDisplayHand(data.hand);
    }
}

function updateAndDisplayHand(newHand) {
    hand = newHand
    var html = "<ul>";
    for (var i = 0; i < hand.length; i++) {
	html += "<li>" + hand[i].desc + "</li>";
    }
    html += '</ul>';
    $('#hand').html(html);
}

// Visual update that we're out of white cards.
function white() {
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