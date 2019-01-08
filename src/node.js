const Server = require('./server')
const Client = require('./client')
const getHash = require('./utils/get-hash')

module.exports = class Node {
  constructor({ address, port, rightIp, leftIp, leader, leaderIp }) {
    this.address = address
    this.port = port
    this.rightIp = rightIp
    this.leftIp = leftIp
    this.leader = leader
    this.leaderIp = leaderIp
    this.voting = false
    this.client = new Client({ node: this })
    this.server = new Server({ node: this, address: this.address, port: this.port })
    this.clock = 0
  }

  incrementClock() {
    this.clock += 1
  }

  synchronizeClock(message) {
    this.clock = Math.max(this.clock, message.clock || 0) + 1
  }

  log(text) {
    console.log(text)
  }

  ip() {
    return `${this.address}:${this.port}`
  }

  setRightIp(ip) {
    this.rightIp = ip
    this.log(`Right was set to ${ip}`)
  }

  setLeftIp(ip) {
    this.leftIp = ip
    this.log(`Left was set to ${ip}`)
  }

  rightUrl() {
    if (this.rightIp) return this.rightIp
  }

  leftUrl() {
    if (this.leftIp) return this.leftIp
  }

  hash() {
    return getHash(this.ip())
  }
  
  createServer() {
    this.server.start()
  }
}