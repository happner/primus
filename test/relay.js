module.exports = Relay;

var net = require('net');
var Promise = require('bluebird');

function Relay(opts) {
  this.forwardToPort = opts.forwardToPort;
  this.listenPort = opts.listenPort;
  this.inSockets = [];
  this.outSockets = [];
}

Relay.prototype.listen = function () {
  var _this = this;
  return new Promise(function (resolve, reject) {
    _this.server = net.createServer();

    function onError(error) {
      _this.server.removeListener('listening', onListening);
      reject(error);
    }

    function onListening() {
      _this.server.removeListener('error', onError);
      resolve();
    }

    _this.server.once('error', onError);
    _this.server.once('listening', onListening);
    _this.server.on('connection', _this._handleConnection.bind(_this));

    _this.server.listen(_this.listenPort);
  });
};

Relay.prototype.close = function () {
  var _this = this;
  return new Promise(function (resolve) {
    _this.inSockets.forEach(function (socket) {
      socket.destroy();
    });

    _this.outSockets.forEach(function (socket) {
      socket.destroy();
    });

    _this.outSockets.length = 0;
    _this.inSockets.length = 0;

    _this.server.close(function () {
      delete _this.server;
      resolve();
    })
  });
};

Relay.prototype._handleConnection = function (socket) {
  var _this = this;

  this.inSockets.push(socket);

  var forwardSocket = net.connect(this.forwardToPort);
  this.outSockets.push(forwardSocket);

  socket.on('close', function () {
    socket.__closed = true;
    _this.inSockets.splice(_this.inSockets.indexOf(socket), 1);
    forwardSocket.destroy(); // relay close
  });

  socket.on('data', function (buf) {
    // console.log('IN:\n', buf.toString());
    setTimeout(function () { // delay relay data
      if (!forwardSocket.__closed) forwardSocket.write(buf);
    }, _this.latency);
  });

  forwardSocket.on('close', function () {
    forwardSocket.__closed = true;
    _this.outSockets.splice(_this.outSockets.indexOf(forwardSocket), 1);
    socket.destroy(); // relay close
  });

  forwardSocket.on('data', function (buf) {
    // console.log('OUT:\n', buf.toString());
    setTimeout(function () { // delay relay data
      if (!socket.__closed) socket.write(buf);
    }, _this.latency);
  });
};
