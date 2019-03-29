let net = require('net'),
    singleton = require('./Singleton'),
    handler = require('./PeersHandler');

singleton.init();

let os = require('os');
let ifaces = os.networkInterfaces();
let HOST = '';
let PORT = singleton.getPort(); //get random port number
let maxpeers = 6;
let ITPVersion = '3314';

// get the loaclhost ip address
Object.keys(ifaces).forEach(function (ifname) {
    ifaces[ifname].forEach(function (iface) {
        if ('IPv4' == iface.family && iface.internal !== false) {
            HOST = iface.address;
        }
    });
});

// get current folder name
//let path = __dirname.split("\\");
let path = __dirname.split("/");
let peerLocation = path[path.length - 1];
let localPeer = {'port': PORT, 'IP': HOST};
let knownPeer = {};

// run as a server
let serverPeer = net.createServer();
serverPeer.listen(PORT, HOST);
console.log('This peer address is ' + HOST + ':' + PORT + ' located at ' + peerLocation);

// initialize peer table
let peerTable = {};
let unpeerTable = {};
serverPeer.on('connection', function (sock) {
    // received connection request
    handler.handleClientJoining(sock, maxpeers, peerLocation, peerTable);
});

if (process.argv.length > 2) {
    // call as node peer [-p <serverIP>:<port> -n <maxpeers> -v <version>]

    // run as a client
    // this needs more work to properly filter command line arguments
    for (var flag = 2; flag < process.argv.length; flag++) {
        if (process.argv[flag] === '-p') {
            var pattern = /^\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}:\d+$/;
            if (process.argv[flag + 1] && process.argv[flag + 1].match( pattern ))                
                knownPeer = {'port': parseInt(process.argv[flag + 1].split(':')[1]), 'IP': process.argv[flag + 1].split(':')[0]};
            else
                console.log('Bad address!... it should be <serverIP>:<port>');
        }
        if (process.argv[flag] === '-n'){
            if(process.argv[flag + 1] && parseInt(process.argv[flag + 1]) > 0)
                maxpeers = parseInt(process.argv[flag + 1]);
            else
                console.log('maxPeers should be a non-zero positive number, using default 6.');
        }
        if (process.argv[flag] === '-v'){
            if(process.argv[flag + 1])                
                ITPVersion = process.argv[flag + 1];
            else
                console.log('Incorrect ITP version, using default 3314.');
        }
    }
    
    if (knownPeer.IP)
        handler.handleConnect(knownPeer, localPeer, maxpeers, peerLocation, peerTable)
}


