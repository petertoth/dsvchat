const Node = require('./src/node')

function start() {
  const ip = process.argv[2]
  const [address, port] = ip.split(':')
  const rightIp = process.argv[3]
  const leader = rightIp ? false : true
  const node = new Node({ address, port, leader })
  if (rightIp) node.setRightIp(rightIp)
  node.createServer()
  node.client.connect()
  node.client.prompt()
}

start()