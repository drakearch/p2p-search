var ITPpacket = require('./ITPpacketResponse'),
    singleton = require('./Singleton');

// You may need to add some delectation here
var fs = require('fs');
var sequenceNumber = 123; 

var clientNumber;
var image;

module.exports = {

    handleClientJoining: function (sock) {
        

    	sequenceNumber = sequenceNumber%999;

		var d = new Date();
    	clientNumber = d.getTime()%100000;
		
		console.log('Client-' + clientNumber + ' is connected at timestamp: ' + d.getTime()%100000 + '\n');
		sock.on('data', readRespond);

		sock.on('close', function(data) {
			console.log('Client-' + clientNumber + ' closed the connection' + '\n');
			clientNumber = d.getTime()%100000;
		});

		function readRespond(data) {
			var test = "" + data;
			image = fs.readFileSync("images/" + test.substr(5,100) + "jpg", function(err,data){
				if (err) throw err;
			});

			console.log('Client-' + clientNumber + 'requests:\n' + 
				'    --ITP version: ' + test.substr(0, 4) + '\n    --Request Type: ' + test.substr(4,1) + '\n    --Image file name: ' + test.substr(5,100) + 'jpg\n');
		
			sock.write('--ITP version = ' + test.substr(0, 4) + '\n--Response Type = ' + test.substr(4, 1)
				+ '\n--Sequence Number = ' + sequenceNumber + '\n--Timestamp = ' + d.getTime()%100000 + '\n--Imagesize = ' + image.toString().length.toString()
				);


			setTimeout(function() {
				sock.write(image);
			}, 1000);

		}

		sequenceNumber++;
		
        
    }



};


