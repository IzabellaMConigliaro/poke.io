(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
	var Semaphore = require('./lib/Semaphore');
	var CondVariable = require('./lib/CondVariable');
	var Mutex = require('./lib/Mutex');
	var ReadWriteLock = require('./lib/ReadWriteLock');


	exports.Semaphore = Semaphore;
	exports.CondVariable = CondVariable;
	exports.Mutex = Mutex;
	exports.ReadWriteLock = ReadWriteLock;


	exports.createCondVariable = function (initialValue) {
		return new CondVariable(initialValue);
	};

	exports.createSemaphore = function (initialCount) {
		return new Semaphore(initialCount);
	};

	exports.createMutex = function () {
		return new Mutex();
	};

	exports.createReadWriteLock = function () {
		return new ReadWriteLock();
	};

},{"./lib/CondVariable":2,"./lib/Mutex":3,"./lib/ReadWriteLock":4,"./lib/Semaphore":5}],2:[function(require,module,exports){
	function CondVariable(initialValue) {
		this._value = initialValue;
		this._waiting = [];
	}

	module.exports = CondVariable;


	function condToFunc(cond) {
		if (typeof cond === 'function') {
			return cond;
		}

		if (typeof cond === 'number' || typeof cond === 'boolean' || typeof cond === 'string') {
			return function (value) {
				return value === cond;
			};
		}

		if (cond && typeof cond === 'object' && cond instanceof RegExp) {
			return function (value) {
				return cond.test(value);
			};
		}

		throw new TypeError('Unknown condition type: ' + (typeof cond));
	}


	CondVariable.prototype.get = function () {
		return this._value;
	};


	CondVariable.prototype.wait = function (cond, cb) {
		var test = condToFunc(cond);

		if (test(this._value)) {
			return cb.call(this);
		}

		this._waiting.push({ test: test, cb: cb });
	};


	CondVariable.prototype.set = function (value) {
		this._value = value;

		for (var i = 0; i < this._waiting.length; i++) {
			var waiter = this._waiting[i];

			if (waiter.test(value)) {
				this._waiting.splice(i, 1);
				i -= 1;
				waiter.cb.call(this);
			}
		}
	};

},{}],3:[function(require,module,exports){
	function Mutex() {
		this.isLocked = false;
		this._waiting = [];
	}

	module.exports = Mutex;


	Mutex.prototype.lock = function (cb) {
		if (this.isLocked) {
			this._waiting.push(cb);
		} else {
			this.isLocked = true;
			cb.call(this);
		}
	};


	Mutex.prototype.timedLock = function (ttl, cb) {
		if (!this.isLocked) {
			this.isLocked = true;
			return cb.call(this);
		}

		var timer, that = this;

		this._waiting.push(function () {
			clearTimeout(timer);

			if (!cb) {
				that.unlock();
				return;
			}

			cb.call(this);
			cb = null;
		});

		timer = setTimeout(function () {
			if (cb) {
				cb.call(this, new Error('Lock timed out'));
				cb = null;
			}
		}, ttl);
	};


	Mutex.prototype.tryLock = function () {
		if (this.isLocked) {
			return false;
		}

		this.isLocked = true;
		return true;
	};


	Mutex.prototype.unlock = function () {
		if (!this.isLocked) {
			throw new Error('Mutex is not locked');
		}

		var waiter = this._waiting.shift();

		if (waiter) {
			waiter.call(this);
		} else {
			this.isLocked = false;
		}
	};

},{}],4:[function(require,module,exports){
	function ReadWriteLock() {
		this.isLocked = false;
		this._readLocks = 0;
		this._waitingToRead = [];
		this._waitingToWrite = [];
	}

	module.exports = ReadWriteLock;


	ReadWriteLock.prototype.readLock = function (cb) {
		if (this.isLocked === 'W') {
			this._waitingToRead.push(cb);
		} else {
			this._readLocks += 1;
			this.isLocked = 'R';
			cb.call(this);
		}
	};


	ReadWriteLock.prototype.writeLock = function (cb) {
		if (this.isLocked) {
			this._waitingToWrite.push(cb);
		} else {
			this.isLocked = 'W';
			cb.call(this);
		}
	};


	ReadWriteLock.prototype.timedReadLock = function (ttl, cb) {
		if (this.tryReadLock()) {
			return cb.call(this);
		}

		var timer, that = this;

		function waiter() {
			clearTimeout(timer);

			if (cb) {
				var callback = cb;
				cb = null;
				callback.apply(that, arguments);
			}
		}

		this._waitingToRead.push(waiter);

		timer = setTimeout(function () {
			var index = that._waitingToRead.indexOf(waiter);
			if (index !== -1) {
				that._waitingToRead.splice(index, 1);
				waiter(new Error('ReadLock timed out'));
			}
		}, ttl);
	};


	ReadWriteLock.prototype.timedWriteLock = function (ttl, cb) {
		if (this.tryWriteLock()) {
			return cb.call(this);
		}

		var timer, that = this;

		function waiter() {
			clearTimeout(timer);

			if (cb) {
				var callback = cb;
				cb = null;
				callback.apply(that, arguments);
			}
		}

		this._waitingToWrite.push(waiter);

		timer = setTimeout(function () {
			var index = that._waitingToWrite.indexOf(waiter);
			if (index !== -1) {
				that._waitingToWrite.splice(index, 1);
				waiter(new Error('WriteLock timed out'));
			}
		}, ttl);
	};


	ReadWriteLock.prototype.tryReadLock = function () {
		if (this.isLocked === 'W') {
			return false;
		}

		this.isLocked = 'R';
		this._readLocks += 1;
		return true;
	};


	ReadWriteLock.prototype.tryWriteLock = function () {
		if (this.isLocked) {
			return false;
		}

		this.isLocked = 'W';
		return true;
	};


	ReadWriteLock.prototype.unlock = function () {
		var waiter;

		if (this.isLocked === 'R') {
			this._readLocks -= 1;

			if (this._readLocks === 0) {
				// allow one write lock through

				waiter = this._waitingToWrite.shift();
				if (waiter) {
					this.isLocked = 'W';
					waiter.call(this);
				} else {
					this.isLocked = false;
				}
			}
		} else if (this.isLocked === 'W') {
			// allow all read locks or one write lock through

			var rlen = this._waitingToRead.length;

			if (rlen === 0) {
				waiter = this._waitingToWrite.shift();
				if (waiter) {
					this.isLocked = 'W';
					waiter.call(this);
				} else {
					this.isLocked = false;
				}
			} else {
				this.isLocked = 'R';
				this._readLocks = rlen;

				var waiters = this._waitingToRead.slice();
				this._waitingToRead = [];

				for (var i = 0; i < rlen; i++) {
					waiters[i].call(this);
				}
			}
		} else {
			throw new Error('ReadWriteLock is not locked');
		}
	};

},{}],5:[function(require,module,exports){
	function Semaphore(initialCount) {
		this._count = initialCount || 1;
		this._waiting = [];
	}

	module.exports = Semaphore;


	Semaphore.prototype.wait = function (cb) {
		this._count -= 1;

		if (this._count < 0) {
			this._waiting.push(cb);
		} else {
			cb.call(this);
		}
	};


	Semaphore.prototype.signal = function () {
		this._count += 1;

		if (this._count <= 0) {
			var waiter = this._waiting.shift();
			if (waiter) {
				waiter.call(this);
			}
		}
	};

},{}],6:[function(require,module,exports){


	/********************************************************/
	/*
	/*					BEGINNING CODE
	/*
	/********************************************************/

	var locks = require('locks');

	var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update, render: render });

	function preload () {
		game.load.image('background', 'assets/background.png');
		game.load.atlas('currentPlayer', 'assets/sprites_pokemon.png', 'assets/sprites_pokemon.json');
		game.load.atlas('enemy', 'assets/sprites_pokemon.png', 'assets/sprites_pokemon.json');
		game.load.image('logo', 'assets/logo.png');
	}

	var socket;
	var land;
	var player;
	var enemies;
	var logo;
	var currentSpeed = 300;
	var cursors;
	var playerCollisionGroup;
	var enemiesCollisionGroup;

	function create () {
		socket = io.connect();

		var playerId;

		socket.on('connect', function () {
			playerId = socket.io.engine.id;

			var numb = playerId.replace(/\D/g,'');
			numb = numb%24;

			player.frame = numb;
		});

		var bounds = new Phaser.Rectangle(0, 0, 800, 600);

		game.world.setBounds(0, 0, 800, 600)
		game.physics.startSystem(Phaser.Physics.P2JS);
		game.physics.p2.setImpactEvents(true);

		game.physics.p2.updateBoundsCollisionGroup();

		playerCollisionGroup = game.physics.p2.createCollisionGroup();
		enemiesCollisionGroup = game.physics.p2.createCollisionGroup();

		land = game.add.tileSprite(0, 0, 800, 600, 'background');
		land.fixedToCamera = true;

		logo = game.add.sprite(20, 150, 'logo');
		logo.bringToTop();
		game.input.onDown.add(removeLogo, this);

		var startX = Math.round(Math.random() * (1000) - 500);
		var startY = Math.round(Math.random() * (1000) - 500);

		player = game.add.sprite(startX, startY, 'currentPlayer');
		player.anchor.setTo(0.5, 0.5);

		game.physics.enable(player, Phaser.Physics.P2JS);
		player.body.collideWorldBounds = true;
		player.body.setCircle(16);
		player.body.fixedRotation = true;
		game.physics.p2.enable(player, false);
		player.body.setCollisionGroup(playerCollisionGroup);

		player.body.collides(enemiesCollisionGroup, hitEnemies, this);

		customBounds = { left: null, right: null, top: null, bottom: null };

		enemies = [];

		player.bringToTop();
		logo.bringToTop();

		game.camera.follow(player);
		game.camera.deadzone = new Phaser.Rectangle(150, 150, 500, 300);
		createPreviewBounds(bounds.x, bounds.y, bounds.width, bounds.height);

		game.camera.focusOnXY(0, 0);

		cursors = game.input.keyboard.createCursorKeys();

		setTimeout(removeLogo, 1000);

		setEventHandlers()
	}

	function createPreviewBounds(x, y, w, h) {
		var sim = game.physics.p2;
		var mask = sim.boundsCollisionGroup.mask;

		customBounds.left = new p2.Body({ mass: 0, position: [ sim.pxmi(x), sim.pxmi(y) ], angle: 1.5707963267948966 });
		customBounds.left.addShape(new p2.Plane());

		customBounds.right = new p2.Body({ mass: 0, position: [ sim.pxmi(x + w), sim.pxmi(y) ], angle: -1.5707963267948966 });
		customBounds.right.addShape(new p2.Plane());

		customBounds.top = new p2.Body({ mass: 0, position: [ sim.pxmi(x), sim.pxmi(y) ], angle: -3.141592653589793 });
		customBounds.top.addShape(new p2.Plane());

		customBounds.bottom = new p2.Body({ mass: 0, position: [ sim.pxmi(x), sim.pxmi(y + h) ] });
		customBounds.bottom.addShape(new p2.Plane());

		sim.world.addBody(customBounds.left);
		sim.world.addBody(customBounds.right);
		sim.world.addBody(customBounds.top);
		sim.world.addBody(customBounds.bottom);
	}

	var setEventHandlers = function () {
		socket.on('connect', onSocketConnected);

		socket.on('disconnect', onSocketDisconnect);

		socket.on('new player', onNewPlayer);

		socket.on('move player', onMovePlayer);

		socket.on('remove player', onRemovePlayer);

		socket.on('collision', onCollision);

		socket.on('send lock', onSendLock);

		socket.on('release lock', onReleaseLock);
	};

	function onSocketConnected () {
		console.log('Connected to socket server');

		enemies.forEach(function (enemy) {
			enemy.player.kill()
		});
		enemies = [];

		socket.emit('new player', { x: player.x, y: player.y, angle: player.angle });
	}

	function onSocketDisconnect () {
		console.log('Disconnected from socket server');
	}

	function onNewPlayer (data) {
		console.log('New player connected:', data.id);

		var duplicate = playerById(data.id);
		if (duplicate) {
			console.log('Duplicate player!');
			return
		}

		enemies.push(new RemotePlayer(data.id, game, player, data.x, data.y, data.angle));
		enemies[enemies.length - 1].player.body.setCollisionGroup(enemiesCollisionGroup);
		enemies[enemies.length - 1].player.body.collides([enemiesCollisionGroup, playerCollisionGroup]);
		enemies[enemies.length - 1].player.body.damping = 1;
	}

	function onMovePlayer (data) {
		var movePlayer = playerById(data.id);

		if (!movePlayer) {
			console.log('Player not found: ', data.id);
			return
		}

		movePlayer.player.x = data.x;
		movePlayer.player.y = data.y;
		movePlayer.player.angle = data.angle;
	}

	function onRemovePlayer (data) {
		var removePlayer = playerById(data.id);

		if (!removePlayer) {
			console.log('Player not found: ', data.id);
			return
		}

		removePlayer.player.kill();

		enemies.splice(enemies.indexOf(removePlayer), 1)
	}

	function onCollision (collisionID) {
		console.log(collisionID);
		socket.emit('collision', collisionID)
	}

	function onSendLock (lockEnemies, idEnemies) {
		lockEnemies.__proto__ = locks.createMutex().__proto__;

		lockEnemies.lock(function () {
			console.log('We got the lock!');
			console.log(lockEnemies);
			lockEnemies.unlock();

			var millisecondsToWait = 30000;
			setTimeout(function() {
				socket.emit('release lock', idEnemies);
			}, millisecondsToWait);

		});
	}

	function onReleaseLock() {
		socket.emit('release lock', idEnemies);
	}

	function update() {
		for (var i = 0; i < enemies.length; i++) {
			if (enemies[i].alive) {
				enemies[i].update();
			}
		}

		player.body.setZeroVelocity();

		if (cursors.left.isDown) {
			player.body.moveLeft(currentSpeed);
		} else if (cursors.right.isDown) {
			player.body.moveRight(currentSpeed);
		}

		if (cursors.up.isDown) {
			player.body.moveUp(currentSpeed);
		} else if (cursors.down.isDown) {
			player.body.moveDown(currentSpeed);
		}

		if (game.input.activePointer.isDown) {
			var RIGHT = 1, LEFT = 0;
			var UP = 0, DOWN = 1;

			if (Math.floor(game.input.x/(game.width/2)) === LEFT) {
				player.body.moveLeft(currentSpeed);
			} else if (Math.floor(game.input.x/(game.width/2)) === RIGHT) {
				player.body.moveRight(currentSpeed);
			}

			if (Math.floor(game.input.y/(game.height/2)) === UP) {
				player.body.moveUp(currentSpeed);
			} else if (Math.floor(game.input.y/(game.height/2)) === DOWN) {
				player.body.moveDown(currentSpeed);
			}
		}

		socket.emit('move player', { x: player.x, y: player.y, angle: player.angle });
	}

	function render () { }

	function playerById (id) {
		for (var i = 0; i < enemies.length; i++) {
			if (enemies[i].player.name === id) {
				return enemies[i]
			}
		}
		return false
	}

	function hitEnemies(body1, body2) {
		for (var i in enemies) {
			if(enemies[i].player.body == body2) {
				break;
			}
		}

		console.info(body2.id, enemies[i].player.body.id);

		onCollision(enemies[i].player.name);
	}

	function removeLogo () {
		game.input.onDown.remove(removeLogo, this);
		logo.kill();
	}

},{"locks":1}]},{},[6]);
