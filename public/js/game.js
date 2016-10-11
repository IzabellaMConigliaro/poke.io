/* global Phaser RemotePlayer io */
var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update, render: render });

function preload () {
  game.load.image('earth', 'assets/scorched_earth.png');
  game.load.image('teste', 'assets/tank2.png');

  game.load.atlas('dude', 'assets/tanks.png', 'assets/tanks.json');
  game.load.atlas('enemy', 'assets/enemy-tanks.png', 'assets/tanks.json');
}

var socket // Socket connection

var land

var player

var enemies

var currentSpeed = 300
var cursors

var playerCollisionGroup
var enemiesCollisionGroup

function create () {
  socket = io.connect()

  // Resize our game world to be a 2000 x 2000 square
  var bounds = new Phaser.Rectangle(0, 0, 800, 600);

  game.world.setBounds(0, 0, 800, 600)
  game.physics.startSystem(Phaser.Physics.P2JS);
  game.physics.p2.setImpactEvents(true);

  game.physics.p2.updateBoundsCollisionGroup();


  playerCollisionGroup = game.physics.p2.createCollisionGroup();
  enemiesCollisionGroup = game.physics.p2.createCollisionGroup();

  // Our tiled scrolling background
  land = game.add.tileSprite(0, 0, 800, 600, 'earth')
  land.fixedToCamera = true

  // The base of our player
  var startX = Math.round(Math.random() * (1000) - 500)
  var startY = Math.round(Math.random() * (1000) - 500)
  player = game.add.sprite(startX, startY, 'dude')
  player.anchor.setTo(0.5, 0.5)
  player.animations.add('move', [0, 1, 2, 3, 4, 5, 6, 7], 20, true)
  player.animations.add('stop', [3], 20, true)

  // This will force it to decelerate and limit its speed
  // player.body.drag.setTo(200, 200)
  game.physics.enable(player, Phaser.Physics.P2JS);
  player.body.collideWorldBounds = true
  player.body.setCircle(16);
  player.body.fixedRotation = true;
  game.physics.p2.enable(player, false);
  player.body.setCollisionGroup(playerCollisionGroup);

  player.body.collides(enemiesCollisionGroup, hitEnemies, this);

  customBounds = { left: null, right: null, top: null, bottom: null };

  // Create some baddies to waste :)


  enemies = []

  player.bringToTop()

  game.camera.follow(player)
  game.camera.deadzone = new Phaser.Rectangle(150, 150, 500, 300)
  createPreviewBounds(bounds.x, bounds.y, bounds.width, bounds.height);

  game.camera.focusOnXY(0, 0)

  cursors = game.input.keyboard.createCursorKeys();

  // Start listening for events
  setEventHandlers()
}

function createPreviewBounds(x, y, w, h) {

  var sim = game.physics.p2;

  //  If you want to use your own collision group then set it here and un-comment the lines below
  var mask = sim.boundsCollisionGroup.mask;

  customBounds.left = new p2.Body({ mass: 0, position: [ sim.pxmi(x), sim.pxmi(y) ], angle: 1.5707963267948966 });
  customBounds.left.addShape(new p2.Plane());
  // customBounds.left.shapes[0].collisionGroup = mask;

  customBounds.right = new p2.Body({ mass: 0, position: [ sim.pxmi(x + w), sim.pxmi(y) ], angle: -1.5707963267948966 });
  customBounds.right.addShape(new p2.Plane());
  // customBounds.right.shapes[0].collisionGroup = mask;

  customBounds.top = new p2.Body({ mass: 0, position: [ sim.pxmi(x), sim.pxmi(y) ], angle: -3.141592653589793 });
  customBounds.top.addShape(new p2.Plane());
  // customBounds.top.shapes[0].collisionGroup = mask;

  customBounds.bottom = new p2.Body({ mass: 0, position: [ sim.pxmi(x), sim.pxmi(y + h) ] });
  customBounds.bottom.addShape(new p2.Plane());
  // customBounds.bottom.shapes[0].collisionGroup = mask;

  sim.world.addBody(customBounds.left);
  sim.world.addBody(customBounds.right);
  sim.world.addBody(customBounds.top);
  sim.world.addBody(customBounds.bottom);

}

var setEventHandlers = function () {
  // Socket connection successful
  socket.on('connect', onSocketConnected)

  // Socket disconnection
  socket.on('disconnect', onSocketDisconnect)

  // New player message received
  socket.on('new player', onNewPlayer)

  // Player move message received
  socket.on('move player', onMovePlayer)

  // Player removed message received
  socket.on('remove player', onRemovePlayer)

  socket.on('collision', onCollision)

  socket.on('send lock', onSendLock)
}

// Socket connected
function onSocketConnected () {
  console.log('Connected to socket server')

  // Reset enemies on reconnect
  enemies.forEach(function (enemy) {
    enemy.player.kill()
  })
  enemies = []

  // Send local player data to the game server
  socket.emit('new player', { x: player.x, y: player.y, angle: player.angle })
}

// Socket disconnected
function onSocketDisconnect () {
  console.log('Disconnected from socket server')
}

// New player
function onNewPlayer (data) {
  console.log('New player connected:', data.id)

  // Avoid possible duplicate players
  var duplicate = playerById(data.id)
  if (duplicate) {
    console.log('Duplicate player!')
    return
  }

  // Add new player to the remote players array
  enemies.push(new RemotePlayer(data.id, game, player, data.x, data.y, data.angle))
  enemies[enemies.length - 1].player.body.setCollisionGroup(enemiesCollisionGroup);
  enemies[enemies.length - 1].player.body.collides([enemiesCollisionGroup, playerCollisionGroup]);

}

// Move player
function onMovePlayer (data) {
  var movePlayer = playerById(data.id)

  // Player not found
  if (!movePlayer) {
    console.log('Player not found: ', data.id)
    return
  }

  // Update player position
  movePlayer.player.x = data.x
  movePlayer.player.y = data.y
  movePlayer.player.angle = data.angle
}

// Remove player
function onRemovePlayer (data) {
  var removePlayer = playerById(data.id)

  // Player not found
  if (!removePlayer) {
    console.log('Player not found: ', data.id)
    return
  }

  removePlayer.player.kill()

  // Remove player from array
  enemies.splice(enemies.indexOf(removePlayer), 1)
}

function onCollision (collisionID) {
  console.log(collisionID)
  socket.emit('collision', collisionID)
}

function onSendLock (lockEnemies) {
  console.log(lockEnemies)
  lockEnemies.lock(function () {
    console.log('We got the lock!');
    console.log(lockEnemies)
    lockEnemies.unlock();
  });
}

function update() {

  // for (var i = 0; i < enemies.length; i++) {
  //   if (enemies[i].alive) {
  //     enemies[i].update()
  //     if(game.physics.p2.collisionGroups(player, enemies[i].player)){
  //       console.info("teste");
  //     }
  //   }
  // }


  player.body.setZeroVelocity();

  if (cursors.left.isDown)
  {
    player.body.moveLeft(currentSpeed);
  }
  else if (cursors.right.isDown)
  {
    player.body.moveRight(currentSpeed);
  }

  if (cursors.up.isDown)
  {
    player.body.moveUp(currentSpeed);
  }
  else if (cursors.down.isDown)
  {
    player.body.moveDown(currentSpeed);
  }

    socket.emit('move player', { x: player.x, y: player.y, angle: player.angle })

}


function render () {

}

// Find player by ID
function playerById (id) {
  for (var i = 0; i < enemies.length; i++) {
    if (enemies[i].player.name === id) {
      return enemies[i]
    }
  }

  return false
}

function hitEnemies(body1, body2) {

  //  body1 is the space ship (as it's the body that owns the callback)
  //  body2 is the body it impacted with, in this case our panda
  //  As body2 is a Phaser.Physics.P2.Body object, you access its own (the sprite) via the sprite property:

  for (var i in enemies) {
    if(enemies[i].player.body == body2) {
      break;
    }
  }

  console.info(body2.id, enemies[i].player.body.id)

  onCollision(enemies[i].player.name)

}
