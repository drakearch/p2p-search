var ITPpacket = require('./ITPpacketResponse'),
    singleton = require('./Singleton');
const fs = require('fs');

var nickNames = {},
    clientIP = {},
    startTimestamp = {};

module.exports = {
    handleClientJoining: function (sock) {
        assignClientName(sock, nickNames);
        const chunks = [];
        console.log('\n' + nickNames[sock.id] + ' is connected at timestamp: ' + startTimestamp[sock.id]);
        sock.on('data', function (requestPacket) {
            handleClientRequests(requestPacket, sock); //read client requests and respond

        });
        sock.on('close', function () {
            handleClientLeaving(sock);
        });
    }
};

function handleClientRequests(data, sock) {
    let version = bytes2number(data.slice(0, 3));
    let requestType = bytes2number(data.slice(3, 4));
    let imageFilename = bytes2string(data.slice(4));

    console.log('\n' + nickNames[sock.id] + ' requests:'
        + '\n    --ITP version: ' + version
        + '\n    --Request type: ' + requestType
        + '\n    --Image file name: \'' + imageFilename +'\'\n');

    fs.readFile('images/' + imageFilename, (err, data) => {
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
            });
        } else {
            console.log('readfile error');
        }
    });
}

function handleClientLeaving(sock) {
    console.log(nickNames[sock.id] + ' closed the connection');
}

function assignClientName(sock, nickNames) {
    sock.id = sock.remoteAddress + ':' + sock.remotePort;
    startTimestamp[sock.id] = singleton.getTimestamp();
    var name = 'Client-' + startTimestamp[sock.id];
    nickNames[sock.id] = name;
    clientIP[sock.id] = sock.remoteAddress;
}

function bytes2string(array) {
    var result = "";
    for (var i = 0; i < array.length; ++i) {
        result += (String.fromCharCode(array[i]));
    }
    return result;
}

function bytes2number(array) {
    var result = "";
    for (var i = 0; i < array.length; ++i) {
        result ^= array[array.length-i-1] << 8*i ;
    }
    return result;
}