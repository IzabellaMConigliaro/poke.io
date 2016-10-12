
var LockModel = function (mLock, mId) {
  var lock = mLock;
  var currentPlayer = -1;
  var listPlayers = [];
  var id = mId;

  var getLock = function () {
    return lock
  };

  var getCurrentPlayer = function () {
    return currentPlayer
  };

  var getListPlayers = function () {
    return listPlayers
  };

  var getId = function () {
    return id
  };

  var setCurrentPlayer = function (newCurrentPlayer) {
    currentPlayer = newCurrentPlayer
  };

  var setListPlayers = function (newPlayer) {
    var flag = true;
    for(var i = 0; i < listPlayers.length; i++) {
      if (listPlayers[i] == newPlayer) {
        flag = false;
      }
    }

    if(flag) {
      listPlayers.push(newPlayer);
    }
  };

  return {
    getLock: getLock,
    getCurrentPlayer: getCurrentPlayer,
    getListPlayers: getListPlayers,
    getId: getId,
    setCurrentPlayer: setCurrentPlayer,
    setListPlayers: setListPlayers
  }
};

module.exports = LockModel;
