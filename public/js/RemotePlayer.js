
var RemotePlayer = function (index, game, player, startX, startY, startAngle) {
  var x = startX;
  var y = startY;
  var angle = startAngle;

  this.game = game;
  //this.health = 3
  this.player = player;
  this.alive = true;

  var numb = index.replace(/\D/g,'');
  numb = numb%24;

  this.player = game.add.sprite(x, y, 'enemy');
  this.player.frame = numb;

  this.player.anchor.setTo(0.5, 0.5);

  this.player.name = index.toString();
  game.physics.enable(this.player, Phaser.Physics.P2JS);
  this.player.body.immovable = true;
  this.player.body.collideWorldBounds = true;
  this.player.body.setCircle(16);

  this.player.body.fixedRotation = true;

  this.player.angle = angle;

  this.lastPosition = { x: x, y: y, angle: angle }
};

RemotePlayer.prototype.update = function () {
  if (this.player.x !== this.lastPosition.x || this.player.y !== this.lastPosition.y || this.player.angle != this.lastPosition.angle) {
    this.player.body.x = this.player.x;
    this.player.body.y = this.player.y;
  }

  this.lastPosition.x = this.player.x;
  this.lastPosition.y = this.player.y;
  this.lastPosition.angle = this.player.angle
};

window.RemotePlayer = RemotePlayer;