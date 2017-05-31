module.exports = Client;

var Primus = require('..');

function Client() {
  this.pingpongs = [];
  this.previousTime;
}

Client.prototype.start = function (url, opts, callback) {
  var _this = this;

  var Socket = Primus.createSocket();
  this.client = new Socket(url, opts);

  this.client.on('incoming::pong', function () {
    var now = Date.now();
    if (!_this.previousTime) {
      console.log('pong 0ms');
      _this.previousTime = now;
    } else {
      console.log('pong', now - _this.previousTime, 'ms');
      _this.previousTime = now;
    }
    _this.pingpongs.push('pong');
  });

  this.client.on('outgoing::ping', function () {
    var now = Date.now();
    if (!_this.previousTime) {
      console.log('ping 0ms');
      _this.previousTime = now;
    } else {
      console.log('ping', now - _this.previousTime, 'ms');
      _this.previousTime = now;
    }
    _this.pingpongs.push('ping');
  });

  this.client.on('open', callback);

  return this;
};


Client.prototype.stop = function () {
  if (this.client) this.client.destroy();
};
