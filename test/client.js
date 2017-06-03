module.exports = Client;

var Primus = require('..');

function Client(primusServer) {
  var _this = this;
  this.primusServer = primusServer;
  this.eventPattern = [];
  this.previousTime;

  this.primusServer.on('heartbeat-skipped', this.skippedHandler = this.onSkipped.bind(this));
  this.primusServer.on('flatline', this.flatlineHandler = this.onFlatlined.bind(this));
}

Client.prototype.start = function (url, opts, callback) {
  var _this = this;

  var Socket = Primus.createSocket();
  this.client = new Socket(url, opts);

  this.client.on('incoming::pong', function () {
    var now = Date.now();
    if (!_this.previousTime) {
      console.log('received pong 0ms');
      _this.previousTime = now;
    } else {
      console.log('received pong', now - _this.previousTime, 'ms');
      _this.previousTime = now;
    }
    _this.eventPattern.push('received pong');
  });

  this.client.on('outgoing::ping', function () {
    var now = Date.now();
    if (!_this.previousTime) {
      console.log('sent ping 0ms');
      _this.previousTime = now;
    } else {
      console.log('sent ping', now - _this.previousTime, 'ms');
      _this.previousTime = now;
    }
    _this.eventPattern.push('sent ping');
  });

  this.client.on('reconnect', function () {
    console.log('reconnect');
    _this.eventPattern.push('reconnect');
  });

  this.client.on('reconnected scheduled', function () {
    console.log('reconnect scheduled');
    _this.eventPattern.push('reconnected scheduled');
  });

  this.client.on('reconnected', function () {
    console.log('reconnected');
    _this.eventPattern.push('reconnected');
  });

  this.client.once('open', callback);

  return this;
};

Client.prototype.onSkipped = function (count) {
  console.log('skipped', count);
  this.eventPattern.push('skipped ' + count);
};

Client.prototype.onFlatlined = function () {
  console.log('flatlined');
  this.eventPattern.push('flatline');
};


Client.prototype.stop = function () {
  this.primusServer.removeListener('heartbeat-skipped', this.skippedHandler);
  this.primusServer.removeListener('flatline', this.flatlineHandler);
  if (this.client) this.client.destroy();
};
