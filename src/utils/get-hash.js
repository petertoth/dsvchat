module.exports = function getHash(input) {
  const len = input.length
  let hash = 0
  for (let i = 0; i < len; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i)
    hash |= 0
  }

  return hash
}