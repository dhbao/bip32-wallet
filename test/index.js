/* global beforeEach, describe, it */

var assert = require('assert')
var bip32utils = require('bip32-utils')
var bitcoin = require('bitcoinjs-lib')
var sinon = require('sinon')

var Wallet = require('../')
var fixtures = require('./fixtures')

var NETWORKS = bitcoin.networks

describe('Wallet', function () {
  var seed, wallet

  beforeEach(function () {
    seed = new Buffer('the quick brown fox jumped over the lazy dog')
    wallet = Wallet.fromSeedBuffer(seed)
  })

  describe('fromSeedBuffer', function () {
    it('defaults to Bitcoin network', function () {
      assert.equal(wallet.getNetwork(), NETWORKS.bitcoin)
    })

    it('uses the network if specified', function () {
      wallet = Wallet.fromSeedBuffer(seed, NETWORKS.testnet)

      assert.equal(wallet.getNetwork(), NETWORKS.testnet)
    })

    it("generates m/0'/0 as the external chain node", function () {
      assert.equal(wallet.external.index, 0)
      assert.equal(wallet.external.depth, 2)
    })

    it("generates m/0'/1 as the internal chain node", function () {
      assert.equal(wallet.internal.index, 1)
      assert.equal(wallet.internal.depth, 2)
    })
  })

  describe('fromSeedHex', function () {
    var seedHex

    beforeEach(function () {
      seedHex = seed.toString('hex')
    })

    it('wraps BIP32Wallet.fromSeedBuffer', sinon.test(function () {
      var mock = this.mock(Wallet)
      mock.expects('fromSeedBuffer').once().withArgs(seed, null)

      Wallet.fromSeedHex(seedHex, null)
    }))
  })

  describe('discover', function () {
    it('wraps bip32utils.discovery', sinon.test(function () {
      var gapLimit = 2
      var query = function () {}
      var callback = function () {}

      var mock = this.mock(bip32utils).expects('discovery')
      mock.twice()

      wallet.discover(gapLimit, query, callback)
      mock.callArgWith(3, null, 0, 1)
    }))

    describe('discover', function () {
      it('each account retains all used addresses and ONE unused address', sinon.test(function () {
        var i = 0
        var results = [
          // external
          true, true, true, false, false, false,

          // internal
          true, true, false, false
        ]

        var query = function (a, callback) {
          i += a.length
          return callback(null, results.slice(i - a.length, i))
        }

        wallet.discover(2, query, function (err) {
          assert.ifError(err)
          assert.equal(wallet.account.chains[0].k, 3)
          assert.equal(wallet.account.chains[1].k, 2)
        })
      }))
    })
  })

  function wrapsBIP32 (functionName, bip32FunctionName, fArgs, bfArgs) {
    bip32FunctionName = bip32FunctionName || functionName

    it('wraps account.' + bip32FunctionName + ' with ' + bfArgs, sinon.test(function () {
      var mock = this.mock(wallet.account).expects(bip32FunctionName)
      mock.withArgs.apply(mock, bfArgs)

      wallet[functionName].apply(wallet, fArgs)
    }))
  }

  describe('containsAddress', function () {
    wrapsBIP32('containsAddress', '', ['X'], ['X'])

    fixtures.wallets.forEach(function (f) {
      var network = NETWORKS[f.network]
      var wallet = Wallet.fromJSON(f.json, network)

      it('returns the expected results', function () {
        Object.keys(f.json.external.map).forEach(function (address) {
          assert(wallet.containsAddress(address))
        })

        Object.keys(f.json.internal.map).forEach(function (address) {
          assert(wallet.containsAddress(address))
        })

        assert(!wallet.containsAddress('1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a'))
      })
    })
  })

  describe('getAllAddresses', function () {
    wrapsBIP32('getAllAddresses')

    fixtures.wallets.forEach(function (f) {
      var network = NETWORKS[f.network]
      var wallet = Wallet.fromJSON(f.json, network)

      it('returns all known addresses', function () {
        var fAllAddresses = Object.keys(f.json.external.map).concat(Object.keys(f.json.internal.map))
        var allAddresses = wallet.getAllAddresses()

        fAllAddresses.forEach(function (address) {
          assert(allAddresses.indexOf(address) !== -1, address)
        })
      })
    })
  })

  describe('getNetwork', function () {
    wrapsBIP32('getNetwork')

    it('returns the accounts network', function () {
      assert.equal(wallet.getNetwork(), wallet.account.getNetwork())
    })
  })

  describe('getReceiveAddress', function () {
    wrapsBIP32('getReceiveAddress', 'getChainAddress', [], [0])

    it('returns the current external Address', function () {
      wallet.nextReceiveAddress()

      assert.equal(wallet.getReceiveAddress(), wallet.account.getChainAddress(0))
    })
  })

  describe('getChangeAddress', function () {
    wrapsBIP32('getChangeAddress', 'getChainAddress', [], [1])

    it('returns the current internal Address', function () {
      wallet.nextChangeAddress()

      assert.equal(wallet.getChangeAddress(), wallet.account.getChainAddress(1))
    })
  })

  describe('isReceiveAddress', function () {
    wrapsBIP32('isReceiveAddress', 'isChainAddress', ['X'], [0, 'X'])

    it('returns true for a valid receive address', function () {
      assert(wallet.isReceiveAddress(wallet.getReceiveAddress()))
    })
  })

  describe('isChangeAddress', function () {
    wrapsBIP32('isChangeAddress', 'isChainAddress', ['X'], [1, 'X'])

    it('returns true for a valid change address', function () {
      assert(wallet.isChangeAddress(wallet.getChangeAddress()))
    })
  })

  describe('nextReceiveAddress', function () {
    wrapsBIP32('nextReceiveAddress', 'nextChainAddress', [], [0])

    it('returns the new receive Address', function () {
      var result = wallet.nextReceiveAddress()

      assert.equal(result, wallet.getReceiveAddress())
    })
  })

  describe('nextChangeAddress', function () {
    wrapsBIP32('nextChangeAddress', 'nextChainAddress', [], [1])

    it('returns the new change Address', function () {
      var result = wallet.nextChangeAddress()

      assert.equal(result, wallet.getChangeAddress())
    })
  })

  describe('fromJSON/toJSON', function () {
    fixtures.wallets.forEach(function (f) {
      var network = NETWORKS[f.network]
      var wallet = Wallet.fromJSON(f.json, network)

      it('imports ' + f.seed.slice(0, 20) + '... from JSON', function () {
        Object.keys(f.json.external.map).forEach(function (address) {
          assert(wallet.account.chains[0].addresses.indexOf(address) !== -1, address)
        })

        Object.keys(f.json.internal.map).forEach(function (address) {
          assert(wallet.account.chains[1].addresses.indexOf(address) !== -1, address)
        })

        assert.equal(wallet.account.chains[0].map, f.json.external.map)
        assert.equal(wallet.account.chains[1].map, f.json.internal.map)
        assert.equal(wallet.unspents, f.json.unspents)
      })

      it('exports ' + f.seed.slice(0, 20) + '... to JSON', function () {
        assert.deepEqual(wallet.toJSON(), f.json)
      })
    })
  })

  describe('buildTransaction', function () {
    fixtures.transactions.forEach(function (f) {
      var wallet

      beforeEach(function () {
        var fwallet = fixtures.wallets[f.wallet]
        var network = NETWORKS[fwallet.network]

        wallet = Wallet.fromJSON(fwallet.json, network)
      })

      if (f.exception) {
        it('throws ' + f.exception, function () {
          assert.throws(function () {
            wallet.buildTransaction(f.inputs, f.outputs, f.feeMax)
          }, new RegExp(f.exception))
        })
      } else {
        it('builds ' + f.description + ' (' + f.expected.txId.slice(0, 20) + '... )', function () {
          var result = wallet.buildTransaction(f.inputs, f.outputs, f.feeMax, null, null, f.locktime)
          var txId = result.transaction.getId()

          // checks
          assert.equal(txId, f.expected.txId)
          assert.equal(result.fee, f.expected.fee)

          var transaction = result.transaction
          assert.equal(transaction.ins.length, f.inputs.length)
          f.inputs.forEach(function (input) {
            assert(transaction.ins.some(function (tinput) {
              return input.txId === bitcoin.bufferutils.reverse(tinput.hash).toString('hex') && input.vout === tinput.index
            }))
          })

          assert.equal(transaction.outs.length, f.outputs.length)
          f.outputs.forEach(function (output) {
            // skip change addresses (see next loop)
            if (!output.address) return

            // otherwise, assert they are the expected scripts
            var outputScript = bitcoin.address.toOutputScript(output.address, wallet.getNetwork())

            // assert address exists
            assert(transaction.outs.some(function (output2) {
              return outputScript.equals(output2.script) && output.value === output2.value
            }))
          })

          // now lets do some sanity checking for the change outputs
          transaction.outs.forEach(function (output) {
            // enforce change addresses are ACTUAL change addresses
            var address = bitcoin.address.fromOutputScript(output.script, wallet.getNetwork())

            if (wallet.containsAddress(address)) {
              // ensure the value exists as a change output
              assert(f.outputs.some(function (output2) {
                return output2.address === undefined && output.value === output2.value
              }))
            }
          })
        })
      }
    })
  })
})
