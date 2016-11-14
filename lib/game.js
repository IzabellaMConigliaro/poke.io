var util = require('util');
var http = require('http');
var path = require('path');
var express = require('express');
var ecstatic = require('ecstatic');
var HashMap = require('hashmap');
var locks = require('locks');
var socketIO = require('socket.io');
//var redis = require('redis');
var redisAdapter = require('socket.io-redis');
var redis = require('redis-eventemitter');

var Player = require('./Player');
var LockModel = require('./LockModel');

var locksMap = new HashMap();
var socket;
var players;

var app = express();

const redisHost = process.argv[3];
const serverPort = process.argv[2];

//clientRedis = redis.createClient();

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', function(req, res) {
  res.sendFile('index.html', { root: path.resolve(__dirname, '../public') });
});

var players = [];

var httpServer = http.createServer( app );
var server = httpServer.listen( serverPort );
socket = socketIO.listen(server);
socket.adapter(redisAdapter({ host: 'localhost' , port : 6379 }));

var pubsub = redis({
  port: 6379,
  host: '127.0.0.1',
  prefix: 'pokeio:'
});

socket.sockets.on('connection', onSocketConnection);

function onSocketConnection (client) {
  client.on('disconnect', onClientDisconnect);

  client.on('new player', onNewPlayer);

  client.on('move player', onMovePlayer);

  client.on('collision', onCollision);

  client.on('send lock', onSendLock);

  client.on('release lock', onReleaseLock);
}

function onClientDisconnect () {
  pubsub.emit('myservice:removeuser', {id: this.id});

  var removePlayer = playerById(this.id);

  var conn = this;

  this.broadcast.emit('remove player', {id: this.id});

  locksMap.forEach(function(value, key) {
    if (value.getCurrentPlayer() == removePlayer.id) {
      //onReleaseLock(key);
      util.log("Unlocking " + key);

      ((locksMap.get(key)).getLock()).unlock();

      if((locksMap.get(key)).getListPlayers()[0] != null
          && (locksMap.get(key)).getListPlayers()[0] != "") {
        util.log((locksMap.get(key)).getListPlayers());

        (locksMap.get(key)).setCurrentPlayer((locksMap.get(key)).getListPlayers()[0]);

        conn.broadcast.to((locksMap.get(key)).getListPlayers()[0]).emit('send lock', lockById(key), key);

        if(!lockById(key).isLocked) {
          pubsub.emit('myservice:locksuccess', {playerId: playerId, collidedId: id});
        }
      } else {
        (locksMap.get(key)).setCurrentPlayer(-1);
      }
    }
  });
}

function onNewPlayer (data) {
  var newPlayer = new Player(data.x, data.y, data.angle);
  newPlayer.id = this.id;

  pubsub.emit('myservice:newuser', {id: newPlayer.id, x: newPlayer.getX(), y: newPlayer.getY(), angle: newPlayer.getAngle()});

  this.broadcast.emit('new player', {id: newPlayer.id, x: newPlayer.getX(), y: newPlayer.getY(), angle: newPlayer.getAngle()});

  var i, existingPlayer;
  for (i = 0; i < players.length; i++) {
    existingPlayer = players[i];
    this.emit('new player', {id: existingPlayer.id, x: existingPlayer.getX(), y: existingPlayer.getY(), angle: existingPlayer.getAngle()});
  }
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

  if((locksMap.get(id)).getCurrentPlayer() == -1 || (locksMap.get(id)).getCurrentPlayer() == playerId) {
    if(!lockById(id).isLocked) {
      pubsub.emit('myservice:locksuccess', {playerId: playerId, collidedId: id});
    }
  } else if((locksMap.get(id)).getCurrentPlayer() != playerId) {
    pubsub.emit('myservice:lockfail', {playerId: playerId, collidedId: id});
  }
}

function onSendLock(id) {
  this.emit('send lock', lockById(id));
}

function onReleaseLock(lockID) {
  pubsub.emit('myservice:releaselock', {lockId: lockID});

  if((locksMap.get(lockID)).getLock().isLocked) {
    util.log("Unlocking " + lockID);
    ((locksMap.get(lockID)).getLock()).unlock();
  }

  if((locksMap.get(lockID)).getListPlayers()[0] != null
      && (locksMap.get(lockID)).getListPlayers()[0] != "") {
    util.log((locksMap.get(lockID)).getListPlayers());

    (locksMap.get(lockID)).setCurrentPlayer((locksMap.get(lockID)).getListPlayers()[0]);

    this.broadcast.to((locksMap.get(lockID)).getListPlayers()[0]).emit('send lock', lockById(lockID), lockID);

    ((locksMap.get(lockID)).getLock()).tryLock(function () {
      pubsub.emit('myservice:locksuccess', {playerId: playerId, collidedId: id});
    });
  } else {
    (locksMap.get(lockID)).setCurrentPlayer(-1);
  }
}

pubsub.on('*:newuser', function(channel, data) {
  var newPlayer = new Player(data.x, data.y, data.angle);
  newPlayer.id = data.id;

  util.log('New player has connected: ' + newPlayer.id);

  players.push(newPlayer);

  locksMap.set(newPlayer.id, new LockModel(locks.createMutex(), newPlayer.id));
});

pubsub.on('*:removeuser', function(channel, data) {
  util.log('Player has disconnected: ' + data.id);

  var removePlayer = playerById(data.id);

  if (!removePlayer) {
    util.log('Player not found: ' + data.id);
    return
  }

  players.splice(players.indexOf(removePlayer), 1);

  locksMap.forEach(function(value, key) {
    if (value.getCurrentPlayer() == removePlayer.id) {
      util.log("Unlocking " + key);

      ((locksMap.get(key)).getLock()).unlock();

      if((locksMap.get(key)).getListPlayers()[0] != null
          && (locksMap.get(lockID)).getListPlayers()[0] != "") {
        util.log((locksMap.get(key)).getListPlayers());

        (locksMap.get(key)).setCurrentPlayer((locksMap.get(lockID)).getListPlayers()[0]);
      } else {
        (locksMap.get(key)).setCurrentPlayer(-1);
      }
    }

    if((value.getListPlayers()).indexOf(removePlayer.id) != -1) {
      (value.getListPlayers()).splice((value.getListPlayers()).indexOf(removePlayer.id), 1);
    }
  });
});

pubsub.on('*:locksuccess', function(channel, data) {
  (lockById(data.collidedId)).lock(function () {
    lockSuccess(data.playerId, data.collidedId);
  });
});

pubsub.on('*:lockfail', function(channel, data) {
  lockFail(data.playerId, data.collidedId);
  util.log((locksMap.get(id)).getListPlayers());
});

pubsub.on('*:releaselock', function(channel, data) {
  var lockID = data.lockId;

  if((locksMap.get(lockID)).getLock().isLocked) {
    util.log("Unlocking " + lockID);
    ((locksMap.get(lockID)).getLock()).unlock();
  }

  if((locksMap.get(lockID)).getListPlayers()[0] != null
      && (locksMap.get(lockID)).getListPlayers()[0] != "") {
    util.log((locksMap.get(lockID)).getListPlayers());

    var nextClient = (locksMap.get(lockID)).getListPlayers().shift();
    (locksMap.get(lockID)).setCurrentPlayer(nextClient);
  } else {
    (locksMap.get(lockID)).setCurrentPlayer(-1);
  }
});

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

  util.log("Lock de " + id + " em " + playerId);
}

function lockFail(playerId, id) {
  (locksMap.get(id)).setListPlayers(playerId);
}
