/* ************************************************
** LOCK MODEL CLASS
************************************************ */
var LockModel = function (mLock) {
  var lock = mLock;
  var currentPlayer = -1;
  var listPlayers = [];

  // Getters and setters
  var getLock = function () {
    return lock
  }

  var getCurrentPlayer = function () {
    return currentPlayer
  }

  var getListPlayers = function () {
    return listPlayers
  }

  var setCurrentPlayer = function (newCurrentPlayer) {
    currentPlayer = newCurrentPlayer
  }

  var setListPlayers = function (newPlayer) {
    listPlayers.push(newPlayer);
  }

  // Define which variables and methods can be accessed
  return {
    getLock: getLock,
    getCurrentPlayer: getCurrentPlayer,
    getListPlayers: getListPlayers,
    setCurrentPlayer: setCurrentPlayer,
    setListPlayers: setListPlayers
  }
}

// Export the LockModel class so you can use it in
// other files by using require("LockModel")
module.exports = LockModel
