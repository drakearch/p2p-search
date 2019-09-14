let net = require('net'),
    singleton = require('./Singleton'),
    handler = require('./PeersHandler');

singleton.init();

let os = require('os');
let ifaces = os.networkInterfaces();
let HOST = '';
let PEER_PORT = singleton.getPort(); //get random PEER port 
let IMAGE_PORT = singleton.getPort(); //get random IMAGE port
let maxpeers = 6; // Default Max number of Peers
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

// Address Objects
let localPeer = {'port': PEER_PORT, 'IP': HOST};
let imageAddress = {'port': IMAGE_PORT, 'IP': HOST};
let knownPeer = {};

// run as a PEER server
let serverPeer = net.createServer();
serverPeer.listen(PEER_PORT, HOST);
console.log('This peer address is ' + BRIGHT + FG_GREEN + HOST + ':' + PEER_PORT + RESET_STYLE + ' located at ' + peerLocation);

// initialize peer and known peers tables
let peerTable = {};
let unpeerTable = {};
unpeerTable[HOST + ':' + PEER_PORT] = {'port': PEER_PORT, 'IP': HOST, 'status': 'me'};

// last n search and received images from peers
let historySearch = [];
let receivedImagePackets = [];

serverPeer.on('connection', function (sock) {
    // received PEER connection request
    handler.handlePeerJoining(sock, maxpeers, peerLocation, peerTable, unpeerTable, historySearch);
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
    
    // Connecting with known PEER get from arguments
    if (knownPeer.IP) 
        handler.handleConnect(knownPeer, localPeer, maxpeers, peerLocation, peerTable, unpeerTable);
}

// Automatic Join
setInterval(function() {
    if (Object.keys(peerTable).length < maxpeers) { // PeerTable is NOT full
        knownPeer = {};       
        // Selecting Peer from available peer. if peer don't have "status" is available
        Object.values(unpeerTable).forEach(peer => {
            if (!('status' in peer) && !knownPeer.IP)
                knownPeer = peer;
        });
        // Trying to connect with known peer
        if (knownPeer.IP) 
            handler.handleConnect(knownPeer, localPeer, maxpeers, peerLocation, peerTable, unpeerTable);
    }
}, 1000);

// Run Image server
let peer2peerDB = net.createServer();
peer2peerDB.listen(IMAGE_PORT, HOST);
console.log('Peer2PeerDB server is started at timestamp: '+singleton.getTimestamp()+' and is listening on ' + BRIGHT + FG_CYAN + HOST + ':' + IMAGE_PORT + RESET_STYLE);

peer2peerDB.on('connection', function(sock) {
    // Received Image connection request
    handler.handleImageJoining(sock, peerTable, historySearch, maxpeers, peerLocation, receivedImagePackets);
});