let net = require('net'),
    singleton = require('./Singleton'),
    peersHandler = require('./PeersHandler'),
    imageHandler = require('./ClientsHandler');

singleton.init();

let os = require('os');
let ifaces = os.networkInterfaces();
let HOST = '';
let PEER_PORT = singleton.getPort(); //get random port number
let IMAGE_PORT = singleton.getPort(); //get random port number
let maxpeers = 6;
let ITPVersion = '3314';

// Console style colors
let RESET_STYLE = "\x1b[0m";
let BRIGHT = "\x1b[1m";
let FG_GREEN = "\x1b[32m";
let FG_CYAN = "\x1b[36m";

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
let localPeer = {'port': PEER_PORT, 'IP': HOST};
let imageAddress = {'port': IMAGE_PORT, 'IP': HOST};
let knownPeer = {};

// run as a peer server
let serverPeer = net.createServer();
serverPeer.listen(PEER_PORT, HOST);
console.log('This peer address is ' + BRIGHT + FG_GREEN + HOST + ':' + PEER_PORT + RESET_STYLE + ' located at ' + peerLocation);

// initialize peer table
let peerTable = {};
let unpeerTable = {};
unpeerTable[HOST + ':' + PEER_PORT] = {'port': PEER_PORT, 'IP': HOST, 'status': 'me'};
serverPeer.on('connection', function (sock) {
    // received connection request
    peersHandler.handleClientJoining(sock, maxpeers, peerLocation, peerTable, unpeerTable);
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
        peersHandler.handleConnect(knownPeer, localPeer, maxpeers, peerLocation, peerTable, unpeerTable);
}

// Automatic Join
setInterval(function() {
    if (Object.keys(peerTable).length < maxpeers) {
        knownPeer = {};
        Object.values(unpeerTable).forEach(peer => {
            if (!('status' in peer) && !knownPeer.IP)
                knownPeer = peer;
        });
        
        if (knownPeer.IP) 
            peersHandler.handleConnect(knownPeer, localPeer, maxpeers, peerLocation, peerTable, unpeerTable);
    }
}, 5000);

let counter = IMAGE_PORT;
setInterval(function() {
    peersHandler.handleSearch(peerTable, peerLocation, {'origin': imageAddress}, counter, 'Image-'+counter+'.jpg');
    counter++;
}, 5000);

// Run Image server
let peer2peerDB = net.createServer();
peer2peerDB.listen(IMAGE_PORT, HOST);
console.log('Peer2PeerDB server is started at timestamp: '+singleton.getTimestamp()+' and is listening on ' + BRIGHT + FG_CYAN + HOST + ':' + IMAGE_PORT + RESET_STYLE);
peer2peerDB.on('connection', function(sock) {
    imageHandler.handleClientJoining(sock);
});