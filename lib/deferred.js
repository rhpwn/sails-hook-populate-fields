 var path = require('path'),
   util = require('util'),
   utils = require('sails/node_modules/waterline/lib/waterline/utils/helpers'),
   normalize = require('sails/node_modules/waterline/lib/waterline/utils/normalize'),
   hasOwnProperty = utils.object.hasOwnProperty,
   libPath = path.join(__dirname, 'lib');

module.exports = function(keyName, criteria, adOpts) {

  var self = this;
  var joins = [];
  var pk = 'id';
  var attr;
  var join;

  // Normalize sub-criteria
  try {
    criteria = normalize.criteria(criteria);

    ////////////////////////////////////////////////////////////////////////
    // TODO:
    // instead of doing this, target the relevant pieces of code
    // with weird expectations and teach them a lesson
    // e.g. `lib/waterline/query/finders/operations.js:665:12`
    // (delete userCriteria.sort)
    //
    // Except make sure `where` exists
    criteria.where = criteria.where===false?false:(criteria.where||{});
    criteria.fields = adOpts.fields;
    ////////////////////////////////////////////////////////////////////////

  }
  catch (e) {
    throw new Error(
      'Could not parse sub-criteria passed to '+
      util.format('`.populate("%s")`', keyName)+
      '\nSub-criteria:\n'+ util.inspect(criteria, false, null)+
      '\nDetails:\n'+util.inspect(e,false, null)
      );
  }

  try {

    // Set the attr value to the generated schema attribute
    attr = this._context.waterline.schema[this._context.identity].attributes[keyName];

    // Get the current collection's primary key attribute
    Object.keys(this._context._attributes).forEach(function(key) {
      if(hasOwnProperty(self._context._attributes[key], 'primaryKey') && self._context._attributes[key].primaryKey) {
        pk = self._context._attributes[key].columnName || key;
      }
    });

    if(!attr) {
      throw new Error(
        'In '+util.format('`.populate("%s")`', keyName)+
        ', attempting to populate an attribute that doesn\'t exist'
        );
    }

    //////////////////////////////////////////////////////////////////////
    ///(there has been significant progress made towards both of these ///
    /// goals-- contact @mikermcneil if you want to help) ////////////////
    //////////////////////////////////////////////////////////////////////
    // TODO:
    // Create synonym for `.populate()` syntax using criteria object
    // syntax.  i.e. instead of using `joins` key in criteria object
    // at the app level.
    //////////////////////////////////////////////////////////////////////
    // TODO:
    // Support Mongoose-style `foo.bar.baz` syntax for nested `populate`s.
    // (or something comparable.)
    // One solution would be:
    // .populate({
    //   friends: {
    //     where: { name: 'mike' },
    //     populate: {
    //       dentist: {
    //         where: { name: 'rob' }
    //       }
    //     }
    //   }
    // }, optionalCriteria )
    ////////////////////////////////////////////////////////////////////


    // Grab the key being populated to check if it is a has many to belongs to
    // If it's a belongs_to the adapter needs to know that it should replace the foreign key
    // with the associated value.
    var parentKey = this._context.waterline.collections[this._context.identity].attributes[keyName];

    // Build the initial join object that will link this collection to either another collection
    // or to a junction table.
    join = {
      parent: this._context.identity,
      parentKey: attr.columnName || pk,
      child: attr.references,
      childKey: attr.on,
      select: Object.keys(this._context.waterline.schema[attr.references].attributes),
      alias: keyName,
      removeParentKey: parentKey.model ? true : false,
      model: hasOwnProperty(parentKey, 'model') ? true : false,
      collection: hasOwnProperty(parentKey, 'collection') ? true : false
    };

    // Build select object to use in the integrator
    var select = [];
    Object.keys(this._context.waterline.schema[attr.references].attributes).forEach(function(key) {
      var obj = self._context.waterline.schema[attr.references].attributes[key];
      if(!hasOwnProperty(obj, 'columnName')) {
        select.push(key);
        return;
      }

      select.push(obj.columnName);
    });

    join.select = select;

    // If linking to a junction table the attributes shouldn't be included in the return value
    if(this._context.waterline.schema[attr.references].junctionTable) join.select = false;

    joins.push(join);

    // If a junction table is used add an additional join to get the data
    if(this._context.waterline.schema[attr.references].junctionTable && hasOwnProperty(attr, 'on')) {

      // clone the reference attribute so we can mutate it
      var reference = _.clone(this._context.waterline.schema[attr.references].attributes);

      // Find the other key in the junction table
      Object.keys(reference).forEach(function(key) {
        var attribute = reference[key];

        if(!hasOwnProperty(attribute, 'references')) {
          delete reference[key];
          return;
        }

        if(hasOwnProperty(attribute, 'columnName') && attribute.columnName === attr.on) {
          delete reference[key];
          return;
        }

        if(hasOwnProperty(attribute, 'columnName') && attribute.columnName !== attr.on) {
          return;
        }

        if(key !== attr.on) delete reference[key];
      });

      // Get the only remaining key left
      var ref = Object.keys(reference)[0];

      if(ref) {

        // Build out the second join object that will link a junction table with the
        // values being populated
        var selects = _.map(_.keys(this._context.waterline.schema[reference[ref].references].attributes), function(attr) {
          var expandedAttr = self._context.waterline.schema[reference[ref].references].attributes[attr];
          return expandedAttr.columnName || attr;
        });

        join = {
          parent: attr.references,
          parentKey: reference[ref].columnName,
          child: reference[ref].references,
          childKey: reference[ref].on,
          select: selects,
          alias: keyName,
          junctionTable: true,
          removeParentKey: parentKey.model ? true : false,
          model: false,
          collection: true
        };

        joins.push(join);
      }
    }

    // Append the criteria to the correct join if available
    if(criteria && joins.length > 1) {
      joins[1].criteria = criteria;
    } else if(criteria) {
      joins[0].criteria = criteria;
    }

    // Set the criteria joins
    this._criteria.joins = Array.prototype.concat(this._criteria.joins || [], joins);

    return this;
  }
  catch (e) {
    throw new Error(
      'Encountered unexpected error while building join instructions for '+
      util.format('`.populate("%s")`', keyName)+
      '\nDetails:\n'+
      util.inspect(e,false, null)
      );
  }
};
