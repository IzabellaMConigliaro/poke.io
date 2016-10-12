var util = require('util');
var http = require('http');
var path = require('path');
var ecstatic = require('ecstatic');
var io = require('socket.io');
var HashMap = require('hashmap');
var locks = require('locks');

var Player = require('./Player');
var LockModel = require('./LockModel');

var port = process.env.PORT || 8080;

var locksMap = new HashMap();
var socket;
var players;

var server = http.createServer(
    ecstatic({ root: path.resolve(__dirname, '../public') })
).listen(port, function (err) {
  if (err) {
    throw err
  }

  init()
});

function init () {
  players = [];

  socket = io.listen(server);

  setEventHandlers()
}

var setEventHandlers = function () {
  socket.sockets.on('connection', onSocketConnection)
};

function onSocketConnection (client) {
  util.log('New player has connected: ' + client.id);

  client.on('disconnect', onClientDisconnect);

  client.on('new player', onNewPlayer);

  client.on('move player', onMovePlayer);

  client.on('collision', onCollision);

  client.on('send lock', onSendLock);

  client.on('release lock', onReleaseLock);
}

function onClientDisconnect () {
  util.log('Player has disconnected: ' + this.id);

  var removePlayer = playerById(this.id);

  if (!removePlayer) {
    util.log('Player not found: ' + this.id);
    return
  }

  players.splice(players.indexOf(removePlayer), 1);

  this.broadcast.emit('remove player', {id: this.id});
}

function onNewPlayer (data) {
  var newPlayer = new Player(data.x, data.y, data.angle);
  newPlayer.id = this.id;

  this.broadcast.emit('new player', {id: newPlayer.id, x: newPlayer.getX(), y: newPlayer.getY(), angle: newPlayer.getAngle()});

  var i, existingPlayer;
  for (i = 0; i < players.length; i++) {
    existingPlayer = players[i];
    this.emit('new player', {id: existingPlayer.id, x: existingPlayer.getX(), y: existingPlayer.getY(), angle: existingPlayer.getAngle()});
  }

  players.push(newPlayer);

  locksMap.set(newPlayer.id, new LockModel(locks.createMutex(), newPlayer.id));
}

function onMovePlayer (data) {
  var movePlayer = playerById(this.id);

  if (!movePlayer) {
    util.log('Player not found: ' + this.id);
    return
  }

  movePlayer.setX(data.x);
  movePlayer.setY(data.y);
  movePlayer.setAngle(data.angle);

  this.broadcast.emit('move player', {id: movePlayer.id, x: movePlayer.getX(), y: movePlayer.getY(), angle: movePlayer.getAngle()});
}

function onCollision(id) {
  var playerId = this.id;

  util.log("Colisao de:" + playerId + " com:"  + id);

  this.emit('send lock', lockById(id), id);

  if((locksMap.get(id)).getCurrentPlayer() == -1) {
    ((locksMap.get(id)).getLock()).lock(function () {
      lockSuccess(playerId, id);
    });
  } else if((locksMap.get(id)).getCurrentPlayer() != playerId) {
    lockFail(this.id, id);
    util.log((locksMap.get(id)).getListPlayers());
  }
}

function onSendLock(id) {
  this.emit('send lock', lockById(id));
}

function onReleaseLock(lockID) {
  util.log("Unlocking " + lockID);

  ((locksMap.get(lockID)).getLock()).unlock();
  (locksMap.get(lockID)).setCurrentPlayer(-1);

  if((locksMap.get(lockID)).getListPlayers()[0] != null
      && (locksMap.get(lockID)).getListPlayers()[0] != "") {
    util.log((locksMap.get(lockID)).getListPlayers());

    var nextClient = (locksMap.get(lockID)).getListPlayers().shift();

    this.broadcast.to(nextClient).emit('send lock', lockById(lockID), lockID);

    ((locksMap.get(lockID)).getLock()).lock(function () {
      lockSuccess(nextClient, lockID);
    });
  }
}

function playerById (id) {
  var i;
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
