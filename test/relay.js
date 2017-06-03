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

Relay.prototype._handleConnection = function (inSocket) {
  var _this = this;

  this.inSockets.push(inSocket);

  var outSocket = net.connect(this.forwardToPort);
  this.outSockets.push(outSocket);

  inSocket.on('close', function () {
    inSocket.__closed = true;
    _this.inSockets.splice(_this.inSockets.indexOf(inSocket), 1);
    outSocket.destroy(); // relay close
  });

  inSocket.on('data', function (buf) {
    // console.log('IN:\n', buf.toString());
    setTimeout(function () { // delay relay data
      if (!outSocket.__closed) outSocket.write(buf);
    }, _this.latency);
  });

  outSocket.on('close', function () {
    outSocket.__closed = true;
    _this.outSockets.splice(_this.outSockets.indexOf(outSocket), 1);
    inSocket.destroy(); // relay close
  });

  outSocket.on('data', function (buf) {
    // console.log('OUT:\n', buf.toString());
    setTimeout(function () { // delay relay data
      if (!inSocket.__closed) inSocket.write(buf);
    }, _this.latency);
  });
};

Relay.prototype.startLargePayload = function () {

  console.log('start large payload');

  // Cork the outbound socket (to server) so that buffer accumulates.
  // Results in pings queueing up (instead of arriving at server) as if after a large payload.

  // Only corking the most recently added socket.

  var outSocket = this.outSockets[this.outSockets.length - 1];
  outSocket.cork();

};

Relay.prototype.stopLargePayload = function () {

  console.log('stop large payload');

  // Uncork all sockets because a new (reconnected one) may have been
  // added at the array's tail.

  this.outSockets.forEach(function (outSocket) {
    outSocket.uncork();
  });

};
