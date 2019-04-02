let net = require('net'),
    cPTPpacket = require('./cPTPmessage'),
    ITPpacket = require('./ITPpacketResponse'),
    singleton = require('./Singleton');
const fs = require('fs');

let peerTable = {},
    peerList = {},
    firstPeerIP = {},
    firstPeerPort = {},
    isFull = {},
    nickNames = {},
    clientIP = {},
    startTimestamp = {};

let TIME_BUSY = 100; // Time waiting until send not found response (ms).
let busy = false;

// Console style colors
let RESET_STYLE = "\x1b[0m";
let BRIGHT = "\x1b[1m";
let FG_YELLOW = "\x1b[33m";

module.exports = {
    // PEER server
    handlePeerJoining: handlePeerJoining,
    handleConnect: handleConnect,
    handleSearch: handleSearch,

    // IMAGE server
    handleImageJoining: handleImageJoining
};

// Handle image server joining
function handleImageJoining (sock, peerTable, searchHistory, maxPeers, sender, imagePackets) {
    assignClientName(sock, nickNames);
    const chunks = [];
    sock.on('data', function (requestPacket) {
        // Handling requests in image server
        handleClientRequests(requestPacket, sock, peerTable, searchHistory, maxPeers, sender, imagePackets); //read client requests and respond
    });
    sock.on('close', function () {
        handleClientLeaving(sock);
    });
}

// Handling Image server requests
function handleClientRequests(data, sock, peerTable, searchHistory, maxPeers, sender, imagePackets) {
    let version = bytes2number(data.slice(0, 3));
    let requestType = bytes2number(data.slice(3, 4));

    // Client Request for a file in P2P search
    if (requestType == 0) {
        // Server busy
        if (busy) {
            console.log('Another client tries to connect. Sending busy response...');
            ITPpacket.init(3, singleton.getSequenceNumber(), singleton.getTimestamp(), [], 0);
            sock.write(ITPpacket.getPacket());
            sock.end();
        } else { // Server is not busy
            busy = true;
            let imageFilename = bytes2string(data.slice(4));
            console.log('\n' + BRIGHT + FG_YELLOW + nickNames[sock.id] + RESET_STYLE + ' is connected at timestamp: ' + startTimestamp[sock.id]);
            console.log('\n' + nickNames[sock.id] + ' requests:'
                + '\n    --ITP version: ' + version
                + '\n    --Request type: ' + requestType
                + '\n    --Image file name: \'' + imageFilename +'\'\n');

            // Searching File locally.
            fs.readFile('images/' + imageFilename, (err, data) => {
                // File locally found.
                if (!err) {
                    var infile = fs.createReadStream('images/' + imageFilename);
                    const imageChunks = [];
                    infile.on('data', function (chunk) {
                        imageChunks.push(chunk);
                    });

                    infile.on('close', function () {
                        let image = Buffer.concat(imageChunks);
                        ITPpacket.init(1, singleton.getSequenceNumber(), singleton.getTimestamp(), image, image.length);
                        sock.write(ITPpacket.getPacket());
                        sock.end();
                        busy = false;
                    });
                } else { // File NOT found in this peer.
                    // Clear Received images...
                    imagePackets.length = 0;
                    console.log(imageFilename, 'not found! Searching in P2P network...');
                    let originAddress = {'origin': {'port': sock.localPort, 'IP': sock.localAddress}};
                    
                    // Searching file in PEERS
                    handleSearch (peerTable, searchHistory, maxPeers, sender, originAddress, sock.remotePort, imageFilename);
                    
                    // Waiting for P2P response
                    let timeTick = 0;
                    let timer = setInterval(function () {
                        // If File is received from P2P network. Send to Client
                        if (imagePackets.length > 0) { 
                            console.log('Sending ' + imageFilename + ' to ' + nickNames[sock.id] + '...');
                            sock.write(imagePackets[0]);
                            sock.end();
                            busy = false;
                            clearInterval(timer);
                        } 
                        // Timeout!!! Send NOT found response.
                        if (timeTick === TIME_BUSY) {
                            console.log(imageFilename, 'not Found in P2P network. Sending NOT FOUND response...');
                            ITPpacket.init(2, singleton.getSequenceNumber(), singleton.getTimestamp(), [], 0);
                            sock.write(ITPpacket.getPacket());
                            sock.end();
                            busy = false;
                            clearInterval(timer);
                        }
                        timeTick++;
                    }, 1);
                }
            });
        }
    }

    // P2P network found file and transfers us.
    if (requestType == 1) {
        imagePackets.push(data);
        console.log('File found in P2P network!');
    }
}

function handleClientLeaving(sock) {
    //console.log(nickNames[sock.id] + ' closed the connection');
    //busy = false;
}

function assignClientName(sock, nickNames) {
    sock.id = sock.remoteAddress + ':' + sock.remotePort;
    startTimestamp[sock.id] = singleton.getTimestamp();
    var name = 'Client-' + startTimestamp[sock.id];
    nickNames[sock.id] = name;
    clientIP[sock.id] = sock.remoteAddress;
}

// Handle Search, prepare search cPTP packet and send to the P2P network
function handleSearch (peerTable, searchHistory, maxPeers, sender, originPeerImageSocket, searchID, filename) {
    // Handling search history, last maxPeers queries.
    let searchKey = searchID + ':' + filename;
    // Update search history
    if(searchHistory.length >= maxPeers)
        searchHistory.shift();
    searchHistory.push(searchKey);

    // Send search packet to peers
    cPTPpacket.init(3, sender, originPeerImageSocket, searchID, filename);
    let searchPacket = cPTPpacket.getPacket();
    sendSearchPacket(peerTable, searchPacket); 
}

// Sending the Query packet to each Peers
function sendSearchPacket (peerTable, searchPacket) {
    Object.values(peerTable).forEach(peer => {
        let searchSock = new net.Socket();
        searchSock.connect(peer.port, peer.IP, function () {
            searchSock.write(searchPacket);
            searchSock.end();
        });
        // Handling error when peer is NOT available.
        searchSock.on('error', function () {
            console.log('Peer', peer.IP + ':' + peer.port, 'is NOT available!');
            searchSock.end();
        });
    }); 
}

// Handling PEER server connections
function handlePeerJoining (sock, maxPeers, sender, peerTable, unpeerTable, searchHistory) {
    sock.on('data', (message) => {
        // Data is <ip_address>:<port>
        var pattern = /^\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}:\d+$/;
        
        // If new Peer is trying to get peer2peer connection.
        if (bytes2string(message).match( pattern )) { 
            let addr = bytes2string(message).split(':');
            let peer = {'port': addr[1], 'IP': addr[0]};
            let peersCount = Object.keys(peerTable).length;
            if (peersCount === maxPeers) 
                declineClient(sock, sender, peerTable, unpeerTable);
            else 
                handleClient(sock, sender, peer, peerTable, unpeerTable)
        }
        
        // Known peer is connecting to send us a Query packet, Peer2Peer Search.
        else {
            let msgType = bytes2number(message.slice(3, 4));
            if (msgType == 3) { // P2P Query packet
                let sender = bytes2string(message.slice(4, 8));
                let searchID = bytes2number(message.slice(8, 12));
                let originPort = bytes2number(message.slice(14, 16));
                let originIP = bytes2number(message.slice(16, 17)) + '.'
                    + bytes2number(message.slice(17, 18)) + '.'
                    + bytes2number(message.slice(18, 19)) + '.'
                    + bytes2number(message.slice(19, 20));
                let imageFilename = bytes2string(message.slice(20));
                
                let searchKey = searchID + ':' + imageFilename;

                // If P2Psearch not in recent search history... else discard packet
                if (searchHistory.indexOf(searchKey) < 0) {
                    // Update search history
                    if(searchHistory.length >= maxPeers)
                        searchHistory.shift();
                    searchHistory.push(searchKey);

                    // Search file locally.
                    fs.readFile('images/' + imageFilename, (err, data) => {
                        if (!err) { // IF image exist locally, Send to ORIGIN peer.
                            console.log('\n', imageFilename, 'found! Sending to ' + originIP + ':' + originPort);
                            let originAddress = {'port': originPort, 'IP': originIP};
                            sendImagePacket('images/' + imageFilename, originAddress);
                        } else { // ELSE send Query packet to each peers.
                            console.log('\n', imageFilename, 'not found! Searching in P2P network...');
                            sendSearchPacket(peerTable, message);
                        }
                    });
                }
            }
        }
    });
}

// Send file to origin peer.
function sendImagePacket (filePath, peer) {
    let imageSock = new net.Socket();
    imageSock.connect(peer.port, peer.IP, function () {
        let infile = fs.createReadStream(filePath);
        const imageChunks = [];
        infile.on('data', function (chunk) {
            imageChunks.push(chunk);
        }); 
        infile.on('close', function () {
            let image = Buffer.concat(imageChunks);
            ITPpacket.init(1, singleton.getSequenceNumber(), singleton.getTimestamp(), image, image.length);
            imageSock.write(ITPpacket.getPacket());
            imageSock.end();
        });
    });
}

// Handling Peer Connections
function handleConnect (knownPeer, localPeer, maxPeers, peerLocation, peerTable, unpeerTable) {
        
    // add the server (the receiver request) into the table as pending
    let pendingPeer = {'port': knownPeer.port, 'IP': knownPeer.IP, 'pending': true};
    let peerAddress = pendingPeer.IP + ':' + pendingPeer.port;
    peerTable[peerAddress] = pendingPeer;

    // Trying to connect to the known peer address
    let clientPeer = new net.Socket();
    clientPeer.connect(knownPeer.port, knownPeer.IP, function () {
        handleCommunication(clientPeer, maxPeers, peerLocation, peerTable, unpeerTable);
        clientPeer.write(localPeer.IP + ':' + localPeer.port);
    });
    // Handling error when peer is not Available
    clientPeer.on('error', function () {
        unpeerTable[peerAddress] = {'port': knownPeer.port, 'IP': knownPeer.IP, 'status': 'error'};
        delete peerTable[peerAddress];
    });
}

// Handle Peer Communications
function handleCommunication (client, maxPeers, location, peerTable, unpeerTable) {
    // get message from server
    client.on('data', (message) => {
        let version = bytes2number(message.slice(0, 3));
        let msgType = bytes2number(message.slice(3, 4));
        let sender = bytes2string(message.slice(4, 8));
        let numberOfPeers = bytes2number(message.slice(8, 12));
        let peerList = {};

        // Get list of known peers of connected peer
        for (var i = 0; i < numberOfPeers; i++) {
            let peerPort = bytes2number(message.slice(14 + i*8, 16 + i*8));
            let peerIP = bytes2number(message.slice(16 + i*8, 17 + i*8)) + '.'
                + bytes2number(message.slice(17 + i*8, 18 + i*8)) + '.'
                + bytes2number(message.slice(18 + i*8, 19 + i*8)) + '.'
                + bytes2number(message.slice(19 + i*8, 20 + i*8));
            let joiningPeer = {'port': peerPort, 'IP': peerIP};
            let peerAddress = peerIP + ':' + peerPort;
            peerList[peerAddress] = joiningPeer;

            // Update unpeerTable, adding just unknown peers
            if (!(peerAddress in unpeerTable))
                unpeerTable[peerAddress] = joiningPeer;
        }

        // IF is a Welcome message
        if (msgType == 1) {
            isFull[client.remotePort] = false;
            console.log("\nConnected to peer " + sender + ":" + client.remotePort + " at timestamp: " + singleton.getTimestamp());

            // add the server (the receiver request) into the table. Updating pending in PeerTable and Status in UnpeerTable
            let receiverPeer = {'port': client.remotePort, 'IP': client.remoteAddress};
            let peerAddress = receiverPeer.IP + ':' + receiverPeer.port;
            peerTable[peerAddress] = receiverPeer;
            unpeerTable[peerAddress] = {'port': client.remotePort, 'IP': client.remoteAddress, 'status': 'peered'}

            console.log("Received ack from " + sender + ":" + client.remotePort);
            Object.values(peerList).forEach(peer => {
                console.log("  which is peered with: " + peer.IP + ":" + peer.port);
            });
        } else { // IF is a DECLINED message
            console.log("Received ack from " + sender + ":" + client.remotePort);
            isFull[client.remotePort] = true;
            Object.values(peerList).forEach(peer => {
                console.log("  which is peered with: " + peer.IP + ":" + peer.port);
            });
            console.log("Join redirected, try to connect to the peer above.");
        
            // remove the server (the receiver request) from the peerTable, and status 'Declined' in unpeerTable
            let peerAddress = client.remoteAddress + ':' + client.remotePort;
            delete peerTable[peerAddress];
            unpeerTable[peerAddress] = {'port': client.remotePort, 'IP': client.remoteAddress, 'status': 'declined'}
        }
    }); 
}

// Handle Accepting client, sending a welcome message
function handleClient(sock, sender, peer, peerTable, unpeerTable) {
    // accept client request
    addClient(peer, peerTable, unpeerTable);

    // send acknowledgment to the client
    cPTPpacket.init(1, sender, peerTable);
    sock.write(cPTPpacket.getPacket());
    sock.end();
}

// Decline peer connection, sending decline message
function declineClient(sock, sender, peerTable, unpeerTable) {
    let peerAddress = sock.remoteAddress + ':' + sock.remotePort;
    unpeerTable[peerAddress] = {'port': sock.remotePort, 'IP': sock.remoteAddress};
    console.log('\nPeer table full: ' + peerAddress + ' redirected');

    // send acknowledgment to the client
    cPTPpacket.init(2, sender, peerTable);
    sock.write(cPTPpacket.getPacket());
    sock.end();
}

function addClient(peer, peerTable, unpeerTable) {
    let peerAddress = peer.IP + ':' + peer.port;
    peerTable[peerAddress] = peer;
    unpeerTable[peerAddress] = {'port': peer.port, 'IP': peer.IP, 'status': 'peered'};
    console.log('\nConnected from peer ' + peerAddress);
}

function bytes2string(array) {
    var result = "";
    for (var i = 0; i < array.length; ++i) {
        if (array[i] > 0)
            result += (String.fromCharCode(array[i]));
    }
    return result;
}

function bytes2number(array) {
    var result = "";
    for (var i = 0; i < array.length; ++i) {
        result ^= array[array.length - i - 1] << 8 * i;
    }
    return result;
}