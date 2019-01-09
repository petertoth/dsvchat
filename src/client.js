const $axios = require('axios')
const getHash = require('./utils/get-hash')
const readline = require('readline')
const ip = require('ip')

module.exports = class Client {
  constructor({ node }) {
    this.node = node
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    rl.setPrompt('> ')

    const { sendMessage, createMessage, sendChat } = this
    rl.on('line', function(line) {
      const sanitizedLine = line.trim()
  
      if (sanitizedLine) {
        if (sanitizedLine.startsWith('!close')) {
          this.sendMessage(this.createMessage({ type: 'CLOSE' }))
        } else {
          this.sendChat(sanitizedLine)
        }
      }
  
      rl.prompt()
    }.bind(this)).on('close', () => {
      process.exit(0)
    })

    this.rl = rl
  }

  prompt() {
    this.rl.prompt()
  }

  connect() {
    if (this.node.rightIp) {
      this.node.log(`Connecting to ${this.node.rightIp}`)
      this.sendMessage(this.createMessage({ type: 'CONNECT' }))
    } else {
      this.node.log('Initial node boostrapped the ring')
    }
  }

  createMessage(options={}) {
    return Object.assign({
      from: this.node.ip(),
      to: this.node.rightIp,
      clock: this.node.clock
    }, options)
  }

  sendMessage(message) {
    const { node } = this
    const that = this

    node.incrementClock()

    $axios.post(`http://${node.rightIp}`, { ...message })
      .then(function(response) {
      })
      .catch(function(err) {
        this.node.log(`Right node unavailable. Repair started. Leader is ${this.node.leaderIp}`)
        this.sendRepairMessage(this.createMessage({ type: 'REPAIR' }))

        let retries = 0

        const retryLoop = setInterval(async function() {
          try {
            await $axios.post(`http://${this.node.rightIp}`, { ...message })
            clearInterval(retryLoop)
          } catch (err) {
            retries += 1

            if (retries >= 20) {
              this.node.log('Failed after 20 attempts. Exiting the process')
              process.exit(0)
            }
          }
        }.bind(this), 200)
      }.bind(that))
  }

  sendRepairMessage(message) {
    const { node } = this

    node.incrementClock()

    $axios.post(`http://${node.leftIp}`, { ...message })
      .then(response => {
      })
      .catch(error => {
      })
  }

  sendRepairedMessage() {
    this.node.incrementClock()

    $axios.post(`http://${this.node.leftIp}`, this.createMessage({ type: 'REPAIRED' }))
    .then(response => {
    })
    .catch(error => {
    })
  }

  handleMessage(message) {
    const { type } = message

    this.node.synchronizeClock(message)

    // setTimeout(function() {
      if (type == 'CONNECT')      return this.handleConnect(message)
      if (type == 'SET_RIGHT')    return this.handleSetRight(message)
      if (type == 'SET_LEFT')     return this.handleSetLeft(message)
      if (type == 'ELECTION')     return this.handleElection(message)
      if (type == 'ELECTED')      return this.handleElected(message)
      if (type == 'CHAT')         return this.handleChat(message)
      if (type == 'CLOSE')        return this.handleClose(message)
      if (type == 'EXIT')         return this.handleExit(message)
      if (type == 'REPAIR')       return this.handleRepair(message)
      if (type == 'REPAIRED')     return this.handleRepaired(message)
    // }.bind(this), 200)
  }

  handleConnect(message) {
    if (message.from != message.to) {
      const [ip, port] = message.from.split(':')

      if (this.node.rightIp && this.node.leftIp) {
        let newMessage = this.createMessage({ type: 'SET_RIGHT' })
        newMessage.to = this.node.rightIp
        this.node.setRightIp(message.from)
        this.sendMessage(newMessage)
      } else {
        this.node.setRightIp(message.from)
        this.node.setLeftIp(message.from)
        this.sendMessage(this.createMessage({ type: 'SET_LEFT' }))
        this.node.log('First node connected')
      }
    }
  }

  handleSetRight(message) {
    this.node.setLeftIp(message.from)
    this.node.setRightIp(message.to)
    this.sendMessage(this.createMessage({ type: 'SET_LEFT' }))
  }

  handleSetLeft(message) {
    this.node.setLeftIp(message.from)
    this.startElection()
  }

  handleElection(message) {
    const fromHash = getHash(message.from)
    this.node.log('Election started')

    if (fromHash > this.node.hash()) {
      this.node.voting = true
      this.sendMessage(message)
    } else if (fromHash < this.node.hash() && !this.node.voting) {
      this.node.voting = true
      this.sendMessage(this.createMessage({ type: 'ELECTION' }))
    } else if (fromHash == this.node.hash()) {
      this.sendMessage(this.createMessage({ type: 'ELECTED' }))
    }
  }

  handleElected(message) {
    this.node.leaderIp = message.from
    this.node.voting = false
    this.node.log(`Leader elected: ${this.node.leaderIp}`)

    if (this.node.ip() != message.from) {
      this.node.leader = false
      this.sendMessage(message)
    } else {
      this.node.leader = true
    }
  }

  handleChat(message) {
    if (this.node.leader) {
      if (!message.visitedLeader) {
        message.visitedLeader = true
        if (message.from != this.node.ip()) this.node.log(`Message ${message.clock} from ${message.from}: ${message.body}`)
        this.sendMessage(message)
      }
    } else {
      if (message.visitedLeader) {
        if (message.from != this.node.ip()) this.node.log(`Message ${message.clock} from ${message.from}: ${message.body}`)
        this.sendMessage(message)
      } else {
        this.sendMessage(message)
      }
    }
  }

  handleClose(message) {
    this.node.log(`Node ${message.from} is leaving the ring`)

    if (this.node.rightIp != message.from) {
      this.sendMessage(message)
    } else {
      this.sendMessage(this.createMessage({ type: 'EXIT' }))
      this.node.setRightIp(message.to)
      this.sendMessage(this.createMessage({ type: 'SET_LEFT' }))
    }
  }

  handleExit(message) {
    this.node.log('Exiting the ring and closing the connection')
    process.exit(0)
  }

  handleRepair(message) {
    if (message.to == this.node.leftIp) {
      this.node.setLeftIp(message.from)
      this.sendRepairedMessage()
    } else {
      this.node.log('Repairing the ring')
      this.sendRepairMessage(message)
    }
  }

  handleRepaired(message) {
    this.node.setRightIp(message.from)
    this.node.log('Ring repaired')
    this.startElection()
  }

  startElection() {
    this.node.voting = true
    this.sendMessage(this.createMessage({ type: 'ELECTION' }))
  }

  sendChat(line) {
    this.sendMessage(this.createMessage({ type: 'CHAT', body: line }))
  }
}