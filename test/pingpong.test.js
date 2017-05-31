var Primus = require('..');
var http = require('http');
var expect = require('expect.js');

var Relay = require('./relay');
var Client = require('./client');

var defaultPing = 25000;
var defaultPong = 10000;
var scaleDown = 5; // make shorter ping pong for testing expedience
var primusPort = 8080;
var relayPort = 9090;

describe('pingpong', function () {

  before('start relay', function (done) {
    this.relay = new Relay({
      forwardToPort: primusPort,
      listenPort: relayPort
    });

    this.relay.listen().then(done).catch(done);
  });

  before('start primus server', function (done) {
    this.httpServer = http.createServer();
    this.primusServer = new Primus(this.httpServer, {
      pongSkipTime: 100
    });

    this.httpServer.listen(primusPort, done);
  });

  after('stop primus server', function (done) {
    this.httpServer.close(done);
  });

  after('stop relay', function (done) {
    this.relay.close().then(done).catch(done);
  });

  [
    ((defaultPong / 4) - 100) / scaleDown, // latency less that 1/4 of pong timeout
    ((defaultPong / 4) + 100) / scaleDown  // latency greater that 1/4 of pong timeout

  ].forEach(function (latency) {

    context('with latency ' + latency + ' (scaled down from ' + latency * scaleDown + ') and no large payload', function () {

      // Ensure that pong amplification does not occur due to allowSkip sending unsolicited pongs.

      before('start client', function (done) {
        this.timeout(20000);

        this.relay.latency = latency;

        this.client = new Client();
        this.client.start('http://localhost:' + relayPort, {
          ping: defaultPing / scaleDown,
          pong: defaultPong / scaleDown
        }, done);
      });

      it('does expected pingpong pattern', function (done) {
        this.timeout(31000);
        var _this = this;

        setTimeout(function () {
          _this.client.stop();

          if (latency == ((defaultPong / 4) - 100) / scaleDown) {
            expect(_this.client.pingpongs).to.eql([
              'ping',
              'pong',
              'ping',
              'pong',
              'ping',
              'pong',
              'ping',
              'pong',
              'ping',
              'pong'
            ]);
          } else if (latency == ((defaultPong / 4) + 100) / scaleDown) {
            expect(_this.client.pingpongs).to.eql([
              'ping',
              'pong',
              'ping',
              'pong',
              'ping',
              'pong',
              'ping',
              'pong',
              'ping'
            ]);
          } else {
            throw new Error('Missing test.');
          }

          done();
        }, 30000);

      });

    });

  });

});
