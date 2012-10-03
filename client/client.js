var socket
, myIdx
, SERVER_EVENTS = ['init', 'join', 'leave', 'rejoin', 'gameHash', 'admin', 'tzar', 'refill', 'white', 'black'];

// This will be the main function that will be called after loading client.js. 
// Needs to create the socket connection via Socket.io.
function startGame() {
    socket = io.connect();

    // Find out what this window parameter is
    SERVER_EVENTS.forEach(function(event) {
	socket.on(event, window[event]);
    });
}

// Initializes the player's view with information. 
// Data is comprised of myIdx and players.
// We then display the player's and their scores in the view.
function init(data) {
}

// Updates the client that a player now occupies playerIdx.
// What should happen here is that we show players that there is now a new player with playerIdx. IE player1 or player3
function join(playerIdx) {
}

// Opposite of leave.
// Remove the div elements that contain this player.
function leave(playerIdx) {
}

// CUrrently it's the same as join. dont implement yet, maybe we dont need it.
function rejoin(playerIdx) {
}

// This is the hash of the game.
// For example, the url to a game will be www.cah.com/game/#!/123AB and 123AB will be the hash of the game.
// We'll have to update the url address with this hash.
// We also will have a text box somewhere that says 'share this url to invite' and we'll have to update
// that textbox with the right url.
function gameHash(hash) {
    
}

// Visual update of who the new admin is.
function admin(adminIdx) {
    
}

// Visual update of who the new tzar is.
function tzar(tzarIdx) {
}

// Inside data is the playerIdx and the white cards that this playerIdx will hold.
// Update the visuals with the cards.
function refill(data) {
}

// Visual update that we're out of white cards.
function white() {
}

// Visual update that we're out of black cards (ie game is about to end)
function black() {
}