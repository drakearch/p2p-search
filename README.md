#  Peer to Peer Search

```sh
$ cd p1/
$ node peer.js -n 2
This peer address is 127.0.0.1:23077 located at p1
Peer2PeerDB server is started at timestamp: 284 and is listening on 127.0.0.1:20276
```


```sh
$ cd p2/
$ node peer.js -p 127.0.0.1:23077 -n 3
This peer address is 127.0.0.1:37581 located at p2
Peer2PeerDB server is started at timestamp: 624 and is listening on 127.0.0.1:11399

Connected to peer p1:23077 at timestamp: 625
Received ack from p1:23077
  which is peered with: 127.0.0.1:37581
```

```sh
Connected from peer 127.0.0.1:37581
```


```sh
$ cd p3/
$ node peer.js -p 127.0.0.1:23077 -n 2
This peer address is 127.0.0.1:38448 located at p3
Peer2PeerDB server is started at timestamp: 670 and is listening on 127.0.0.1:41846

Connected to peer p1:23077 at timestamp: 671
Received ack from p1:23077
  which is peered with: 127.0.0.1:37581
  which is peered with: 127.0.0.1:38448

Connected to peer p2:37581 at timestamp: 769
Received ack from p2:37581
  which is peered with: 127.0.0.1:23077
  which is peered with: 127.0.0.1:38448
```


```sh
Connected from peer 127.0.0.1:38448
```


```sh
Connected from peer 127.0.0.1:38448
```


```sh
$ cd p4/
$ node peer.js -p 127.0.0.1:23077 -n 3
This peer address is 127.0.0.1:8180 located at p4
Peer2PeerDB server is started at timestamp: 871 and is listening on 127.0.0.1:35205
Received ack from p1:23077
  which is peered with: 127.0.0.1:37581
  which is peered with: 127.0.0.1:38448
Join redirected, try to connect to the peer above.

Connected to peer p2:37581 at timestamp: 970
Received ack from p2:37581
  which is peered with: 127.0.0.1:23077
  which is peered with: 127.0.0.1:38448
  which is peered with: 127.0.0.1:8180
Received ack from p3:38448
  which is peered with: 127.0.0.1:23077
  which is peered with: 127.0.0.1:37581
Join redirected, try to connect to the peer above.
```


```sh
Peer table full: 127.0.0.1:40418 redirected
```


```sh
Connected from peer 127.0.0.1:8180
```



```sh
Peer table full: 127.0.0.1:44222 redirected
```