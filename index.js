'use strict';

/**
 * @description allow model to define its custom validation scenarios.
 *
 * @param  {Object} sails a sails application instance
 */

 var path = require('path'),
   libPath = path.join(__dirname, 'lib'),
   Deferred = require('sails/node_modules/waterline/lib/waterline/query/deferred'),
   deferred = require(path.join(libPath, 'deferred'));


 module.exports = function(sails) {

  function patch() {
    Deferred.prototype.populate = deferred;
  }

  return {
    initialize: function(done) {
      var eventsToWaitFor = [];
      if (sails.hooks.orm) {
        eventsToWaitFor.push('hook:orm:loaded');
      }
      if (sails.hooks.pubsub) {
        eventsToWaitFor.push('hook:pubsub:loaded');
      }
      sails.after(eventsToWaitFor, function() {
        patch();
        done();
      });
    }
  };

};
