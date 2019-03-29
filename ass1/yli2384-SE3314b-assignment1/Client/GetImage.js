var net = require('net');
var fs = require('fs');
var ITPpacket = require('./ITPpacketRequest')

var opn = require('opn'); // uncomment this line after you run npm install command

// Enter your code for the client functionality here
// Consider the code given in unit 7 slide 40 as a base and build upon it

var HOST = '127.0.0.1';
var PORT = 3000;
var client = new net.Socket();
var itp = 0;

process.argv.forEach(function (val, index, array) {
	if(index == 3){
		HOST = val.split(":")[0];
		PORT = val.split(":")[1];
	} 
	if(index == 5){
		imgName = val.split("j")[0];
	}
	if(index == 7){
		ipt = val;
	}

});

client.connect(PORT, HOST, function() {
	console.log('Connected to ImageDB server on: ' + HOST + ':' + PORT);
	ITPpacket.init(ipt, imgName);
	client.write(ITPpacket.getpacket());
});

client.on('data', function(data) {
	var temp = data + "";
	if(temp.substr(0, 4) == "--IT"){
		console.log('Server sent: \n\n' + data + '\n');
	} else{
		fs.writeFileSync((imgName + 'jpg'), (data),'binary', (err) => {
			if (err) throw err;
		});
		opn((imgName + 'jpg')).then(() => {

		});
		client.destroy();
	}
	
});

client.on('close', function() {
	console.log('Disconnected from the server\nConnection closed');
	client.destroy();
});