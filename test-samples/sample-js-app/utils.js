const { encrypt } = require('./index');

function processData(input) {
  return encrypt(input, 'secret-key');
}

module.exports = { processData };
