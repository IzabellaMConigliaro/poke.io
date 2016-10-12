var util = require('util')
var http = require('http')
var path = require('path')
var ecstatic = require('ecstatic')
var io = require('socket.io')
var HashMap = require('hashmap');
var locks = require('locks');

var Player = require('./Player')
var LockModel = require('./LockModel')

var port = process.env.PORT || 8080

var locksMap = new HashMap();

/* ************************************************
** GAME VARIABLES
************************************************ */
var socket	// Socket controller
var players	// Array of connected players

/* ************************************************
** GAME INITIALISATION
************************************************ */

// Create and start the http server
var server = http.createServer(
  ecstatic({ root: path.resolve(__dirname, '../public') })
).listen(port, function (err) {
  if (err) {
    throw err
  }

  init()
})

function init () {
  // Create an empty array to store players
  players = []

  // Attach Socket.IO to server
  socket = io.listen(server)

  // Start listening for events
  setEventHandlers()
}

/* ************************************************
** GAME EVENT HANDLERS
************************************************ */
var setEventHandlers = function () {
  // Socket.IO
  socket.sockets.on('connection', onSocketConnection)
}

// New socket connection
function onSocketConnection (client) {
  util.log('New player has connected: ' + client.id)

  // Listen for client disconnected
  client.on('disconnect', onClientDisconnect)

  // Listen for new player message
  client.on('new player', onNewPlayer)

  // Listen for move player message
  client.on('move player', onMovePlayer)

  client.on('collision', onCollision)

  client.on('send lock', onSendLock)

  client.on('release lock', onReleaseLock)


}

// Socket client has disconnected
function onClientDisconnect () {
  util.log('Player has disconnected: ' + this.id)

  var removePlayer = playerById(this.id)

  // Player not found
  if (!removePlayer) {
    util.log('Player not found: ' + this.id)
    return
  }

  // Remove player from players array
  players.splice(players.indexOf(removePlayer), 1)

  // Broadcast removed player to connected socket clients
  this.broadcast.emit('remove player', {id: this.id})
}

// New player has joined
function onNewPlayer (data) {
  // Create a new player
  var newPlayer = new Player(data.x, data.y, data.angle)
  newPlayer.id = this.id

  // Broadcast new player to connected socket clients
  this.broadcast.emit('new player', {id: newPlayer.id, x: newPlayer.getX(), y: newPlayer.getY(), angle: newPlayer.getAngle()})

  // Send existing players to the new player
  var i, existingPlayer
  for (i = 0; i < players.length; i++) {
    existingPlayer = players[i]
    this.emit('new player', {id: existingPlayer.id, x: existingPlayer.getX(), y: existingPlayer.getY(), angle: existingPlayer.getAngle()})
  }

  // Add new player to the players array
  players.push(newPlayer)

  // Add lock of new player to the HashMap
  locksMap.set(newPlayer.id, new LockModel(locks.createMutex(), newPlayer.id));
  console.log((locksMap.get(newPlayer.id)).getLock());

}

// Player has moved
function onMovePlayer (data) {
  // Find player in array
  var movePlayer = playerById(this.id)

  // Player not found
  if (!movePlayer) {
    util.log('Player not found: ' + this.id)
    return
  }

  // Update player position
  movePlayer.setX(data.x)
  movePlayer.setY(data.y)
  movePlayer.setAngle(data.angle)

  // Broadcast updated position to connected socket clients
  this.broadcast.emit('move player', {id: movePlayer.id, x: movePlayer.getX(), y: movePlayer.getY(), angle: movePlayer.getAngle()})
}

function onCollision(id) {
  var playerId = this.id;

  util.log("Colisao de:" + playerId + " com:"  + id);

  console.log((locksMap.get(id)).getLock());

  this.emit('send lock', lockById(id), id);

  if((locksMap.get(id)).getCurrentPlayer() == -1) {
    ((locksMap.get(id)).getLock()).lock(function () {
      console.log((locksMap.get(id)).getLock());

      lockSuccess(playerId, id);
    });
  } else if((locksMap.get(id)).getCurrentPlayer() != playerId) {
    lockFail(this.id, id);
    console.log((locksMap.get(id)).getListPlayers());
  }
}

function onSendLock(id) {
  this.emit('send lock', lockById(id));
}

function onReleaseLock(lockID) {
  util.log("Unlocking " + lockID);

  ((locksMap.get(lockID)).getLock()).unlock();
  (locksMap.get(lockID)).setCurrentPlayer(-1);

  console.log((locksMap.get(lockID)).getLock());

  if((locksMap.get(lockID)).getListPlayers()[0] != null
      && (locksMap.get(lockID)).getListPlayers()[0] != "") {
    console.log((locksMap.get(lockID)).getListPlayers());

    var nextClient = (locksMap.get(lockID)).getListPlayers().shift()
    console.log((locksMap.get(lockID)).getListPlayers());
    console.log(nextClient);

    this.broadcast.to(nextClient).emit('send lock', lockById(lockID), lockID);

    ((locksMap.get(lockID)).getLock()).lock(function () {
      lockSuccess(nextClient, lockID);
    });
  }
}

/* ************************************************
** GAME HELPER FUNCTIONS
************************************************ */
// Find player by ID
function playerById (id) {
  var i
  for (i = 0; i < players.length; i++) {
    if (players[i].id === id) {
      return players[i]
    }
  }

  return false
}

function lockById(id) {
  return (locksMap.get(id)).getLock();
}

function lockSuccess(playerId, id) {
  (locksMap.get(id)).setCurrentPlayer(playerId);

  console.log("Lock de " + id + " em " + playerId);
}

function lockFail(playerId, id) {
  (locksMap.get(id)).setListPlayers(playerId);
}
