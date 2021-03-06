'use strict'

var Client = require('../')
var assert = require('chai').assert
var accountSecret = require('./fixtures/account_info').secret
var accountKey = require('./fixtures/account_info').key

var errorFixture = require('./fixtures/create_and_trade_order').error
var success = require('./fixtures/create_and_trade_order').success
var orders = require('./fixtures/create_and_trade_order').orders()
var markets = require('./fixtures/create_and_trade_order').markets()
var async = require('async')

describe('Surbtc REST Client Create and Trade Order', function () {
  async.eachSeries(markets, function (marketId, cb) {
    async.eachSeries(orders, function (order, callback) {
      it('should create and trade order ' + JSON.stringify(order) + ' in market ' + marketId, function (done) {
        var client = new Client({
          api: 'https://stg.surbtc.com/api/v1',
          key: accountKey,
          secret: accountSecret
        })

        client.createAndTradeOrder(marketId, order, function (error, response) {
          assert(!error)
          assert(response)
          assert.deepEqual(success(response), response)
          done()
        })
        client = undefined
      })
      callback()
    })
    cb()
  })

  async.eachSeries(markets, function (marketId, cb) {
    async.eachSeries(orders, function (order, callback) {
      it('should fail to create and trade order ' + JSON.stringify(order) + ' in market ' + marketId, function (done) {
        var client = new Client({
          api: 'https://stg.surbtc.com/api/v1',
          secret: 'jhgkjhgk'
        })

        client.createAndTradeOrder(marketId, order, function (error, response) {
          assert(error)
          assert(!response)
          assert.deepEqual(errorFixture(error), error)
          done()
        })
        client = undefined
      })
      callback()
    })
    cb()
  })
})
