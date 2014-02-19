"use strict";

var Adapter = require('./adapter')(PouchDB);
var utils = require('./utils');
var Promise = typeof global.Promise === 'function' ? global.Promise : require('bluebird');
var EventEmitter = require('events').EventEmitter;

function defaultCallback(err) {
  if (err && global.debug) {
    console.error(err);
  }
}
function makeFailFunction(error) {
  return utils.toPromise(function () {
    arguments[arguments.length - 1](error);
  });
}
utils.inherits(PouchDB, EventEmitter);
function PouchDB(name, opts, callback) {

  if (!(this instanceof PouchDB)) {
    return new PouchDB(name, opts, callback);
  }
  EventEmitter.call(this);
  var self = this;
  if (typeof opts === 'function' || typeof opts === 'undefined') {
    callback = opts;
    opts = {};
  }

  if (typeof name === 'object') {
    opts = name;
    name = undefined;
  }
  if (typeof callback === 'undefined') {
    callback = defaultCallback;
  }
  var oldCB = callback;
  var promise = new Promise(function (fulfill, reject) {
    callback = function (err, resp) {
      if (err) {
        return reject(err);
      }
      delete resp.then;
      fulfill(resp);
    };
  
    opts = utils.extend(true, {}, opts);
    var originalName = opts.name || name;
    var backend, error;
    (function () {
      try {

        if (typeof originalName !== 'string') {
          error = new Error('Missing/invalid DB name');
          error.code = 400;
          throw error;
        }

        backend = PouchDB.parseAdapter(originalName);
        
        opts.originalName = originalName;
        opts.name = backend.name;
        opts.adapter = opts.adapter || backend.adapter;

        if (!PouchDB.adapters[opts.adapter]) {
          error = new Error('Adapter is missing');
          error.code = 404;
          throw error;
        }

        if (!PouchDB.adapters[opts.adapter].valid()) {
          error = new Error('Invalid Adapter');
          error.code = 404;
          throw error;
        }
      } catch (err) {
        self.put = self.get = self.post = self.bulkDocs = makeFailFunction(err);
        self.allDocs = self.putAttachment = self.removeAttachment = self.put;
        self.remove = self.revsDiff = self.getAttachment = self.put;
        self.replicate = {};
        self.replicate.to = self.replicate.from = self.put;
        self.id = self.info = self.compact = self.put;
        self.changes = utils.toPromise(function (opts) {
          if (opts.complete) {
            opts.complete(err);
          }
        });
      }
    }());
    if (error) {
      return reject(error); // constructor error, see above
    }
    var adapter = new Adapter(opts, function (err) {
      if (err) {
        if (callback) {
          callback(err);
        }
        return;
      }

      for (var plugin in PouchDB.plugins) {
        if (PouchDB.plugins.hasOwnProperty(plugin)) {
          // In future these will likely need to be async to allow the plugin
          // to initialise
          var pluginObj = PouchDB.plugins[plugin](self);
          for (var api in pluginObj) {
            if (pluginObj.hasOwnProperty(api)) {
              // We let things like the http adapter use its own implementation
              // as it shares a lot of code
              if (!(api in self)) {
                self[api] = pluginObj[api];
              }
            }
          }
        }
      }

      self.taskqueue.ready(true);
      self.taskqueue.execute(self);
      self.emit('created', self);
      callback(null, self);
    });
    for (var j in adapter) {
      if (adapter.hasOwnProperty(j)) {
        self[j] = adapter[j];
      }
    }
    for (var plugin in PouchDB.plugins) {
      if (PouchDB.plugins.hasOwnProperty(plugin)) {

        // In future these will likely need to be async to allow the plugin
        // to initialise
        var pluginObj = PouchDB.plugins[plugin](self);
        for (var api in pluginObj) {
          if (pluginObj.hasOwnProperty(api)) {
            // We let things like the http adapter use its own implementation
            // as it shares a lot of code
            if (!(api in self)) {
              self[api] = pluginObj[api];
            }
          }
        }
      }
    }
  });
  promise.then(function (resp) {
    oldCB(null, resp);
  }, oldCB);
  self.then = promise.then.bind(promise);
  //prevent deoptimizing
  (function () {
    try {
      self.catch = promise.catch.bind(promise);
    } catch (e) {}
  }());
  var listners = 0, changes;
  var eventNames = ['change', 'delete', 'create', 'update'];
  this.on('newListener', function (eventName) {
    if (~eventNames.indexOf(eventName)) {
      if (listners) {
        listners++;
        return;
      } else {
        listners++;
      }
    } else {
      return;
    }
    changes = this.changes({
      conflicts: true,
      include_docs: true,
      continuous: true,
      since: 'latest',
      onChange: function (change) {
        self.emit('change', change);
        if (change.doc._deleted) {
          self.emit('delete', change.doc);
        } else if (change.doc._rev.split('-')[0] === '1') {
          self.emit('create', change.doc);
        } else {
          self.emit('update', change.doc);
        }
      }
    });
  });
  this.on('removeListener', function (eventName) {
    if (~eventNames.indexOf(eventName)) {
      listners--;
      if (listners) {
        return;
      }
    } else {
      return;
    }
    changes.cancel();
  });
}

module.exports = PouchDB;
