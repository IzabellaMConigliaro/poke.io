
var RemotePlayer = function (index, game, player, startX, startY, startAngle) {
  var x = startX
  var y = startY
  var angle = startAngle

  this.game = game
  this.health = 3
  this.player = player
  this.alive = true

  var sprites = ["tank1", "tank2", "tank3", "tank4", "tank5", "tank6"];

  var numb = index.replace(/\D/g,'');
  //numb = numb.join("");
  numb = numb%6;

  this.player = game.add.sprite(x, y, 'enemy', sprites[numb]);

  this.player.animations.add('move', [0, 1, 2, 3, 4, 5, 6, 7], 20, true)
  this.player.animations.add('stop', [3], 20, true)

  this.player.anchor.setTo(0.5, 0.5)

  this.player.name = index.toString()
  game.physics.enable(this.player, Phaser.Physics.P2JS)
  //game.physics.enable(this.player, Phaser.Physics.ARCADE)
  this.player.body.immovable = true
  this.player.body.collideWorldBounds = true
  this.player.body.setCircle(16);

  this.player.body.fixedRotation = true;

  this.player.angle = angle

  this.lastPosition = { x: x, y: y, angle: angle }
}

RemotePlayer.prototype.update = function () {
  if (this.player.x !== this.lastPosition.x || this.player.y !== this.lastPosition.y || this.player.angle != this.lastPosition.angle) {
    this.player.body.x = this.player.x;
    this.player.body.y = this.player.y;
    //this.player.rotation = Math.PI + game.physics.arcade.angleToXY(this.player, this.lastPosition.x, this.lastPosition.y)
  }

  this.lastPosition.x = this.player.x
  this.lastPosition.y = this.player.y
  this.lastPosition.angle = this.player.angle
}

window.RemotePlayer = RemotePlayer