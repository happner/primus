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
      pongSkipTime: 200
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

    context('with latency ' + latency +
      ' (scaled down from ' + latency * scaleDown + ') and no large payload', function () {

      // Ensure that pong amplification does not occur due to
      // allowSkip sending unsolicited pongs early because of latency.

      before('start client', function (done) {
        this.timeout(20000);

        this.relay.latency = latency;

        this.client = new Client(this.primusServer);
        this.client.start('http://localhost:' + relayPort, {
          ping: defaultPing / scaleDown,
          pong: defaultPong / scaleDown
        }, done);
      });

      it('does expected event pattern', function (done) {
        this.timeout(31000);
        var _this = this;

        setTimeout(function () {

          _this.client.stop();

          if (latency == ((defaultPong / 4) - 100) / scaleDown) {
            expect(_this.client.eventPattern).to.eql([
              'sent ping',
              'received pong',
              'sent ping',
              'received pong',
              'sent ping',
              'received pong',
              'sent ping',
              'received pong',
              'sent ping',
              'received pong'
            ]);
          } else if (latency == ((defaultPong / 4) + 100) / scaleDown) {
            expect(_this.client.eventPattern).to.eql([
              'sent ping',
              'skipped 1',
              'received pong',
              'sent ping',
              'skipped 1', // High latency causes skip at server...
              'received pong',
              'sent ping',
              'skipped 1', // but the skip count is reset when the next ping arrives.
              'received pong',
              'sent ping',
              'skipped 1',
              'received pong',
              'sent ping',
              'skipped 1'
            ]);
          } else {
            throw new Error('Missing test.');
          }

          done();

        }, 30000);

      });

    });

    if (!process.version.match(/^v0\.10/)) {

      context('with latency ' + latency +
        ' (scaled down from ' + latency * scaleDown + ') and large payload not exceeding allowed skip', function () {

        // Ensure that connection resumes properly when large payload transmission time
        // does not exceed allowedSkip time.


        before('start client', function (done) {
          this.timeout(20000);

          this.relay.latency = latency;

          this.client = new Client(this.primusServer);
          this.client.start('http://localhost:' + relayPort, {
            ping: defaultPing / scaleDown,
            pong: defaultPong / scaleDown
          }, done);
        });

        it('does expected event pattern', function (done) {
          this.timeout(31000);
          var _this = this;

          // Ensure that the socket is not disconnected when the pings
          // are caught behind a large payload whose transmission time
          // does not exceed the allowedSkip at the server.

          this.relay.startLargePayload();

          // End the large payload before the server closes the socket
          // ie. after 2 skips

          function onSkip(count) {
            if (count == 2) {
              _this.primusServer.removeListener('heartbeat-skipped', onSkip);
              setTimeout(function () {
                _this.relay.stopLargePayload();
              }, 100);
            }
          }

          this.primusServer.on('heartbeat-skipped', onSkip);

          setTimeout(function () {

            _this.client.stop();
            if (latency == ((defaultPong / 4) - 100) / scaleDown) {
              expect(_this.client.eventPattern).to.eql([
                'sent ping',
                'skipped 1',
                'received pong',
                'sent ping',
                'skipped 2',
                'received pong',
                'sent ping',
                'received pong',
                'sent ping',
                'received pong',
                'sent ping',
                'received pong'
              ]);
            } else if (latency == ((defaultPong / 4) + 100) / scaleDown) {

              if (_this.client.eventPattern[_this.client.eventPattern.length - 1] != 'skipped 1') {
                // timeout is borderline on this last event being present
                _this.client.eventPattern.push('skipped 1');
              }

              expect(_this.client.eventPattern).to.eql([
                'sent ping',
                'skipped 1',
                'received pong',
                'sent ping',
                'skipped 2',
                'received pong',
                'sent ping',
                'received pong',
                'sent ping',
                'skipped 1',
                'received pong',
                'sent ping',
                'skipped 1'
              ]);
            } else {
              throw new Error('Missing test.');
            }

            done();

          }, 30000);

        });

      });

      context('with latency ' + latency +
        ' (scaled down from ' + latency * scaleDown + ') and large payload exceeding allowed skip', function () {

        // Ensure that connection resumes properly when large payload transmission time
        // does exceed allowedSkip time.


        before('start client', function (done) {
          this.timeout(20000);

          this.relay.latency = latency;

          this.client = new Client(this.primusServer);
          this.client.start('http://localhost:' + relayPort, {
            ping: defaultPing / scaleDown,
            pong: defaultPong / scaleDown
          }, done);
        });

        it('does expected event pattern', function (done) {
          this.timeout(31000);
          var _this = this;

          // Ensure that the socket is disconnected when the pings
          // are caught behind a large payload whose transmission time
          // exceeds the allowedSkip at the server.

          this.relay.startLargePayload();

          function onFlatline() {
            _this.primusServer.removeListener('flatline', onFlatline);
            setTimeout(function () {
              _this.relay.stopLargePayload(); // allows proper socket close()
            }, 100);
          }

          this.primusServer.on('flatline', onFlatline);

          setTimeout(function () {

            _this.client.stop();

            if (latency == ((defaultPong / 4) - 100) / scaleDown) {

              expect(_this.client.eventPattern).to.eql([
                'sent ping',
                'skipped 1',
                'received pong',
                'sent ping',
                'skipped 2',
                'received pong',
                'sent ping',
                'flatline',
                'reconnect',
                'reconnected',
                'sent ping',
                'received pong'
              ]);

            } else if (latency == ((defaultPong / 4) + 100) / scaleDown) {

              expect(_this.client.eventPattern).to.eql([
                'sent ping',
                'skipped 1',
                'received pong',
                'sent ping',
                'skipped 2',
                'received pong',
                'sent ping',
                'flatline',
                'reconnect',
                'reconnected',
                'sent ping',
                'skipped 1',
                'received pong'
              ]);

            } else {
              throw new Error('Missing test.');
            }

            done();

          }, 30000);

        });

      });

    }

  });

});
