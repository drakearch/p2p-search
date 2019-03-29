
// You may need to add some delectation here


var ipt = 3314;
var response = 1;
var image = "";

module.exports = {


    init: function(a, b) {// feel free to add function parameters as needed
        ipt = a;
        image = b;
        //
        // enter your code here
        //
    },

    //--------------------------
    //getpacket: returns the entire packet
    //--------------------------
    getpacket: function() {
        PacketRequest = new Buffer.alloc(12);

        var a = ipt + "" + response + image;
        // enter your code here
        return a;
    }


};

