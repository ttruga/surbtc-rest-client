'use strict';

const crypto = require('crypto');
const url    = require('url');
const async  = require('async');
const uuid   = require('node-uuid');
const http   = require('superagent');
const _      = require('lodash');
require('bitcoin-math');
const bitcoinAddress = require('bitcoin-address');

const responseHandler = require('./lib/response_handler');
const colombiaBanks   = require('./lib/banks').colombia;

function Client(options) {
  this.api     = options.api || 'https://www.surbtc.com/api/v2';
  this.key     = options.key || '';
  this.secret  = options.secret || '';
  this.params  = options.params || {};
  this.headers = options.headers || {
    'Accept':       'application/json',
    'Content-Type': 'application/json'
  }
}

Client.prototype._getFullUrl = function (path) {
  return this.api + path
};

Client.prototype._getHmac = function (nonce, method, path, data) {
  // Returns a HMAC based on surBTC auth scheme to be
  // used to build headers when auth is required

  const fullPath = url.parse(this._getFullUrl(path)).path;
  let message = '';

  if (method === 'GET') {
    message = 'GET' + ' ' + fullPath + ' ' + nonce;
  } else if (method === 'POST' || method === 'PUT') {
    const encodedData = new Buffer(JSON.stringify(data)).toString('base64');
    message = method + ' ' + fullPath + ' ' + encodedData + ' ' + nonce;
  } else {
    console.error('Authentication for ' + method + ' is not implemented');
    return
  }

  return crypto
    .createHmac('sha384', this.secret)
    .update(message)
    .digest('hex');
};

Client.prototype._getAuthHeaders = function (method, path, data) {
  // Returns headers for requests that requires auth
  const timestamp = new Date().getTime();

  const authHeaders = {
    'X-SBTC-APIKEY': this.key,
    'X-SBTC-NONCE': timestamp,
    'X-SBTC-SIGNATURE': this._getHmac(timestamp, method, path, data)
  };

  for (let attrname in this.headers) {
    authHeaders[attrname] = this.headers[attrname];
  }

  return authHeaders
};

Client.prototype.getMarkets = function (callback) {
  const path = '/markets';

  http
  .get(this._getFullUrl(path))
  .set(this.headers)
  .end(function (error, response) {
    if (error) {
      responseHandler.errorSet(error, error.response.error);
      return callback(error.json, null)
    }
    responseHandler.success(response, response.body);
    callback(null, response.json)
  })
};

Client.prototype.getBalances = function (currency, callback) {
  let path = '/balances';

  if (currency) {
    path = `${path}/${currency}`;
  }

  // Requires auth
  if (this.secret === '') {
    let err = {};
    responseHandler.invalidRequest(err, 'InvalidRequest:ApiKeyRequired', null);
    return callback(err.json, null);
  }

  http
  .get(this._getFullUrl(path))
  .set(this._getAuthHeaders('GET', path))
  .end(function (error, response) {
    if (error) {
      responseHandler.errorSet(error, error.response.error);
      return callback(error.json, null);
    }
    responseHandler.success(response, response.body);
    callback(null, response.json)
  })
};

Client.prototype.getExchangeFee = function (marketId, type, marketOrder, callback) {
  // Requires auth
  type = _.capitalize(type);

  let path = '/markets/' + marketId + '/fee_percentage?type=' + type;

  if (this.secret === '') {
    let err = {};
    responseHandler.invalidRequest(err, 'InvalidRequest:ApiKeyRequired', null);
    return callback(err.json, null)
  }

  if (marketOrder) {
    if (_.isFunction(marketOrder)) {
      callback = marketOrder
    } else {
      path += '&market_order=true';
    }
  }

  http
  .get(this._getFullUrl(path))
  .set(this._getAuthHeaders('GET', path))
  .end(function (error, response) {
    if (error) {
      responseHandler.errorSet(error, error.response.error);
      return callback(error.json, null);
    }
    responseHandler.success(response, response.body);
    callback(null, response.json);
  })
};

Client.prototype.generateUUID = function (callback) {
  callback(null, {status: 'success', uuid: uuid.v4()})
};

Client.prototype.getOrderBook = function (marketId, callback) {
  const path = '/markets/' + marketId + '/order_book';

  http
  .get(this._getFullUrl(path))
  .set(this.headers)
  .end(function (error, response) {
    if (error) {
      responseHandler.errorSet(error, error.response.error);
      return callback(error.json, null);
    }
    responseHandler.success(response, response.body);
    callback(null, response.json);
  })
}

Client.prototype.getQuotation = function (marketId, type, amount, callback) {
  // Requires auth
  type = _.lowerCase(type);

  const path = '/markets/' + marketId + '/quotations';

  if (this.secret === '') {
    let err = {};
    responseHandler.invalidRequest(err, 'InvalidRequest:ApiKeyRequired', null);
    return callback(err.json, null);
  }

  let data = {
    quotation: {
      type: type,
      reverse: false,
      amount: amount
    }
  };

  http
  .post(this._getFullUrl(path))
  .send(data)
  .set(this._getAuthHeaders('POST', path, data))
  .end(function (error, response) {
    if (error) {
      responseHandler.errorSet(error, error.response.error);
      return callback(error.json, null)
    }
    responseHandler.success(response, response.body)
    callback(null, response.json)
  })
}

Client.prototype.getReverseQuotation = function (marketId, type, amount, callback) {
  // Requires auth
  type = _.lowerCase(type)

  const path = '/markets/' + marketId + '/quotations';

  if (this.secret === '') {
    let err = {};
    responseHandler.invalidRequest(err, 'InvalidRequest:ApiKeyRequired', null);
    return callback(err.json, null)
  }

  let data = {
    quotation: {
      type: type,
      reverse: true,
      amount: amount
    }
  };

  http
  .post(this._getFullUrl(path))
  .send(data)
  .set(this._getAuthHeaders('POST', path, data))
  .end(function (error, response) {
    if (error) {
      responseHandler.errorSet(error, error.response.error);
      return callback(error.json, null);
    }
    responseHandler.success(response, response.body);
    callback(null, response.json);
  })
};

Client.prototype.createOrder = function (marketId, order, callback) {
  // Requires auth
  const path = '/markets/' + marketId + '/orders';

  if (this.secret === '') {
    let err = {};
    responseHandler.invalidRequest(err, 'InvalidRequest:ApiKeyRequired', null);
    return callback(err.json, null);
  }

  http
  .post(this._getFullUrl(path))
  .set(this._getAuthHeaders('POST', path, order))
  .send(order)
  .end(function (error, response) {
    if (error) {
      responseHandler.errorSet(error, error.response.error);
      return callback(error.json, null);
    }

    responseHandler.success(response, response.body);
    callback(null, response.json);
  })
};

Client.prototype._getOrderPages = function (orders, marketId, state, callback, loopFunction) {
  const self = this;

  // check if there are any more pages
  let page = _.toNumber(orders.meta.current_page);

  // filter orders by state
  if (orders.success && state) {
    orders.orders = _.filter(orders.orders, {state: state});
    if (page === orders.meta.total_pages) {
      orders.meta = {total_count: orders.orders.length}
    }
  }

  if (orders.success && page < orders.meta.total_pages) {
    ++page;

    self.getOrdersRaw(marketId, page, function (error, response) {
      if (error) {
        callback(error, null);
        return
      }

      orders.orders = _.concat(orders.orders, response.orders);
      orders.meta.current_page = page;

      loopFunction(orders, marketId, state, callback, loopFunction)
    })
  } else {
    callback(null, orders)
  }
};

Client.prototype._getOrderState = function (order, status, callback, loopFunction) {
  const self = this;

  if (order.success && order.order.state !== status) {
    self.getOrderId(order.order.id, function (error, response) {
      if (error) {
        return callback(error, null)
      }

      setTimeout(function () {
        loopFunction(response, status, callback, loopFunction)
      }, 500)
    })
  } else {
    callback(null, order)
  }
};

Client.prototype.pollOrders = function (orders, marketId, state, callback) {
  const self = this;

  self._getOrderPages(orders, marketId, state, callback,
    self._getOrderPages.bind(this))
};

Client.prototype.pollOrderState = function (order, status, callback) {
  const self = this;

  self._getOrderState(order, status, callback,
    self._getOrderState.bind(this))
};

Client.prototype.getOrdersRaw = function (marketId, page, callback) {
  // Requires auth
  let path = '/markets/' + marketId + '/orders';

  if (this.secret === '') {
    let err = {};
    responseHandler.invalidRequest(err, 'InvalidRequest:ApiKeyRequired', null);
    return callback(err.json, null)
  }

  if (page) {
    path += '?page=' + page
  }

  http
  .get(this._getFullUrl(path))
  .set(this._getAuthHeaders('GET', path))
  .end(function (error, response) {
    if (error) {
      responseHandler.errorSet(error, error.response.error);
      return callback(error.json, null)
    }
    responseHandler.success(response, response.body);
    callback(null, response.json)
  })
};

Client.prototype.getOrders = function (marketId, callback) {
  const self = this;

  async.waterfall([
    function (next) {
      self.getOrdersRaw(marketId, 0, next)
    },
    function (orders, next) {
      self.pollOrders(orders, marketId, false, next)
    }
  ], callback)
};

Client.prototype.getOrdersByState = function (marketId, state, callback) {
  const self = this;

  async.waterfall([
    function (next) {
      self.getOrdersRaw(marketId, 0, next)
    },
    function (orders, next) {
      self.pollOrders(orders, marketId, state, next)
    }
  ], callback)
};

Client.prototype.getOrderId = function (orderId, callback) {
  // Requires auth
  const path = '/orders/' + orderId;

  if (this.secret === '') {
    var err = {}
    responseHandler.invalidRequest(err, 'InvalidRequest:ApiKeyRequired', null)
    return callback(err.json, null)
  }

  http
  .get(this._getFullUrl(path))
  .set(this._getAuthHeaders('GET', path))
  .end(function (error, response) {
    if (error) {
      responseHandler.errorSet(error, error.response.error)
      return callback(error.json, null)
    }
    responseHandler.success(response, response.body);
    callback(null, response.json)
  })
}

Client.prototype.cancelOrderId = function (orderId, callback) {
  // Requires auth
  const path = '/orders/' + orderId;

  if (this.secret === '') {
    let err = {};
    responseHandler.invalidRequest(err, 'InvalidRequest:ApiKeyRequired', null)
    return callback(err.json, null)
  }

  let data = { state: 'canceling' };

  http
  .put(this._getFullUrl(path))
  .set(this._getAuthHeaders('PUT', path, data))
  .send(data)
  .end(function (error, response) {
    if (error) {
      responseHandler.errorSet(error, error.response.error)
      return callback(error.json, null)
    }
    responseHandler.success(response, response.body);
    if (response.json.order.state !== 'canceling' && response.json.order.state !== 'canceled') {
      response.json.success = false;
      response.json.error_type = 'order_not_valid_for_canceling';
      return callback(response.json, null);
    }
    callback(null, response.json);
  })
}

Client.prototype.createAndTradeOrder = function (marketId, order, callback) {
  const self = this;

  async.waterfall([
    function (next) {
      self.createOrder(marketId, order, next)
    },
    function (createdOrder, next) {
      self.pollOrderState(createdOrder, 'traded', next)
    }
  ], callback)
};

Client.prototype.registerBankAccount = function (opts, callback) {
  const currency = _.toUpper(opts.bank_currency);
  const path = '/fiat_accounts/' + currency;

  // get bank id
  const bankId = _.find(colombiaBanks, {name: opts.bank_name}).id;

  const surbtcOpts = {
    email:           opts.email,
    phone:           opts.phone,
    document_number: opts.bank_account_holder_id,
    full_name:       opts.bank_account_holder_name,
    account_number:  opts.bank_account_number,
    account_type:    opts.bank_account_type,
    bank_id:         bankId
  };

  // Requires auth
  if (this.secret === '') {
    let err = {};
    responseHandler.invalidRequest(err, 'InvalidRequest:ApiKeyRequired', null);
    return callback(err.json, null);
  }

  http
  .put(this._getFullUrl(path))
  .set(this._getAuthHeaders('PUT', path, surbtcOpts))
  .send(surbtcOpts)
  .end(function (error, response) {
    if (error) {
      responseHandler.errorSet(error, error.response.error);
      return callback(error.json, null)
    }
    responseHandler.success(response, response.body)
    callback(null, response.json)
  })
};

Client.prototype.requestWithdrawal = function (opts, callback) {
  const path = '/withdrawals';

  opts.currency = _.toUpper(opts.currency);

  const withdrawalOpts = {
    withdrawal_data: {},
    amount: 0,
    currency: opts.currency
  }

  if (opts.currency === 'BTC') {
    // validate target address
    if ((this.api.indexOf('stg') > 0 && !bitcoinAddress.validate(opts.target_address, 'testnet')) ||
       (this.api.indexOf('stg') < 0 && !bitcoinAddress.validate(opts.target_address, 'prod'))) {
      let err1 = {};
      responseHandler.invalidRequest(err1, 'InvalidRequest:InvalidBitcoinAddress', null);
      return callback(err1.json, null);
    } else {
      withdrawalOpts.withdrawal_data.target_address = opts.target_address;
    }

    // BTC to satoshis
    withdrawalOpts.amount = opts.amount.toSatoshi();
  } else if (opts.currency === 'CLP' || opts.currency === 'COP') {
    withdrawalOpts.amount = opts.amount * 100
  }

  // Requires auth
  if (this.secret === '') {
    let err = {};
    responseHandler.invalidRequest(err, 'InvalidRequest:ApiKeyRequired', null);
    return callback(err.json, null)
  }

  http
  .post(this._getFullUrl(path))
  .set(this._getAuthHeaders('POST', path, withdrawalOpts))
  .send(withdrawalOpts)
  .end(function (error, response) {
    if (error) {
      responseHandler.errorSet(error, error.response.error);
      return callback(error.json, null);
    }
    responseHandler.success(response, response.body);
    callback(null, response.json);
  })
}

Client.prototype.registerDeposit = function (opts, callback) {
  const path = '/deposits';

  const depositOpts = {
    amount: opts.amount * 100,
    currency: _.toUpper(opts.currency)
  };

  // Requires auth
  if (this.secret === '') {
    let err = {};
    responseHandler.invalidRequest(err, 'InvalidRequest:ApiKeyRequired', null);
    return callback(err.json, null)
  }

  http
  .post(this._getFullUrl(path))
  .set(this._getAuthHeaders('POST', path, depositOpts))
  .send(depositOpts)
  .end(function (error, response) {
    if (error) {
      responseHandler.errorSet(error, error.response.error);
      return callback(error.json, null)
    }
    responseHandler.success(response, response.body);
    callback(null, response.json)
  })
};

module.exports = Client;
