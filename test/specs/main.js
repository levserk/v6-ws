var server,
    options = {domain:'localhost', port: 8081, path:'/ws', pingTimeout:100000, pingInterval:50000, logLevel:1};

exports.start =  function start(util, Promise, Server, WebSocket, Test){
    var mainTest = new Test(testServerInit, options, true, 'run socket server');
    mainTest.then(function(result){
        if (result) return new Test(testClient, options, true, 'test client');
        else return result;
    })
        .then(function(result){
            if (result) {
                util.log('Main test done, result:', result?'completed':'failed');
                process.exit();
                return false;
            }
            else return result
        })
        .catch(function(result){
            util.log('Main test failed with errors');
            process.exit();
        });

    /**
     * test launch server
     */
    function testServerInit(serverOptions, res, rej){ //Promise
        try{
            server = new Server(serverOptions);
            server.init(function(error){
                if (!error) res(true);
                else rej(error);
            });
        } catch (error){
            rej(error);
        }
    }

    /**
     * test client: connection, messages, rooms
     */
    function testClient(options, res, rej){
        var ws,ss;

        (new Test(testClientConnect, options, true, 'client connection'))
            .then(function(result){
                if (result) return new Test(testMessage, (new Date()).toString(),(new Date()).toString(), 'test client server send message');
                else return result;
            })
            .then(function(result){
                if (result) return new Test(testRooms, 'test_room',true, 'test server rooms');
                else return result;
            })
            .then(function(result){
                res(result);
            })
            .catch(function(error){
                rej(error);
            });

        function testClientConnect(options, res, rej){
            try {
                server.on('connection', wsConnected); // may be error if it done after client 'open'
                ws = new WebSocket('ws://' + options.domain + ':' + options.port + options.path);
                var openTimeout = setTimeout(function () {
                    rej('client connection timeout');
                    ws.removeAllListeners();
                }, 1000);
                ws.on('open', function() {
                    clearTimeout(openTimeout);
                    res(true);
                });
            } catch (error) {
                rej(error);
            }

            function wsConnected(socket) {
                ss = socket;
                server.removeListener('connection', wsConnected);
            }
        }

        function testMessage(data, res, rej){ //Promise
            var _m = 'test message';
            try{
                ws.on('message',wsOnMessage);
                ss.on('message',wssOnMessage);
                ss.send({message:_m, data:data});
            } catch (err){ finish(null, err); }

            function wsOnMessage(wssdata){
                try{
                    wssdata = JSON.parse(wssdata);
                    if (wssdata.message == _m) ws.send(JSON.stringify(wssdata));
                    else finish(null, 'wrong wssdata');
                } catch (err) {  finish(null, err); }
            }

            function wssOnMessage(wsdata){
                if (wsdata.message == _m) finish(wsdata.data);
                else finish(null, 'wrong wsdata')
            }

            function finish(data, err){
                ws.removeListener('message',wsOnMessage);
                ss.removeListener('message',wssOnMessage);
                if (err) rej(err); else res(data);
            }
        }

        function testRooms(data, res, rej){
            var ws2, ss2, message = (new Date).toString();
            try {
                server.on('connection', wsConnected); // may be error if it done after client 'open'
                ws2 = new WebSocket('ws://' + options.domain + ':' + options.port + options.path);
                var openTimeout = setTimeout(function () {
                    rej('second client connection timeout');
                    ws2.removeAllListeners();
                }, 1000);
                ws2.on('open', function() {
                    clearTimeout(openTimeout);
                    socketEnterRoom()
                });
            } catch (error) {
                rej(error);
            }

            function wsConnected(socket) {
                ss2 = socket;
                server.removeListener('connection', wsConnected);
            }

            function socketEnterRoom(){
                ws.on('message',wsOnMessage);
                ss.enterRoom(data);
                ws2.on('message',wsOnMessage);
                ss2.enterRoom(data);
                //ss2.enterRoom(data); enter room already entered
                ss.in(data).send({message:message})
            }

            function wsOnMessage(wssdata){
                try{
                    wssdata = JSON.parse(wssdata);
                    if (wssdata.message == message) finish(true, null);
                    else finish(null, 'wrong wssdata');
                } catch (err) {  finish(null, err); }
            }

            function finish(result, err){
                ss.leaveRoom(data);
                ss.leaveRoom(data); // leave room already leaved
                ss2.leaveRoom(data);
                ss2.leaveRoom(data);// leave empty room
                ws.removeListener('message',wsOnMessage);
                ws2.removeListener('message',wsOnMessage);
                if (err) rej(err); else res(result);
            }
        }
    }
}






