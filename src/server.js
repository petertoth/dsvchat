const http = require('http')

module.exports = class Server {
  constructor({ address, port, node }) {
    this.address = address
    this.node = node
    this.port = port
    this.server = null
  }

  start() {
    const { node, port } = this

    const requestHandler = (request, response) => {
      let body = []
      request.on('data', (chunk) => {
        body.push(chunk)
      }).on('end', () => {
        body = JSON.parse(Buffer.concat(body).toString())
        node.client.handleMessage(body)
      })

      response.statusCode = 200
      response.end()
    }

    const server = http.createServer(requestHandler)
    server.listen(this.port, this.address, (err) => {
      if (err) return console.log('Something bad happened', err)
      this.node.log(`Server is listening on port ${port}`)
    }) 

    this.server = server
  }
}