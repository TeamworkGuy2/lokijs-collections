"use strict";
var CloneUtil = require("./CloneUtil");
/** Resultset class allowing chainable queries.  Intended to be instanced internally.
 *   Collection.find(), Collection.where(), and Collection.chain() instantiate this.
 *
 *   Example:
 *   mycollection.chain()
 *     .find({ 'doors' : 4 })
 *     .where(function(obj) { return obj.name === 'Toyota' })
 *     .data();
 */
var Resultset = /** @class */ (function () {
    /**
     * @param collection The collection which this Resultset will query against.
     * @param queryObj Optional mongo-style query object to initialize resultset with.
     * @param queryFunc Optional javascript filter function to initialize resultset with.
     * @param firstOnly Optional boolean used by collection.findOne().
     */
    function Resultset(collection, queryObj, queryFunc) {
        // add branch() as alias of copy()
        this.branch = Resultset.prototype.copy;
        // retain reference to collection we are querying against
        this.collection = collection;
        // if chain() instantiates with null queryObj and queryFunc, so we will keep flag for later
        this.searchIsChained = (!queryObj && !queryFunc);
        this.filteredrows = [];
        this.filterInitialized = false;
    }
    /** Override of toJSON to avoid circular references
     */
    Resultset.prototype.toJSON = function () {
        var copy = this.copy();
        copy.collection = null;
        return copy;
    };
    /** Allows you to limit the number of documents passed to next chain operation.
     *   A resultset copy() is made to avoid altering original resultset.
     *
     * @param qty The number of documents to return.
     * @returns Returns a copy of the resultset, limited by qty, for subsequent chain ops.
     */
    Resultset.prototype.limit = function (qty) {
        // if this is chained resultset with no filters applied, we need to populate filteredrows first
        if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
            this.filteredrows = Object.keys(this.collection.data).map(_parseInt);
        }
        var rscopy = this.copy();
        rscopy.filteredrows = rscopy.filteredrows.slice(0, qty);
        return rscopy;
    };
    /** Used for skipping 'pos' number of documents in the resultset.
     *
     * @param pos Number of documents to skip; all preceding documents are filtered out.
     * @returns Returns a copy of the resultset, containing docs starting at 'pos' for subsequent chain ops.
     */
    Resultset.prototype.offset = function (pos) {
        // if this is chained resultset with no filters applied, we need to populate filteredrows first
        if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
            this.filteredrows = Object.keys(this.collection.data).map(_parseInt);
        }
        var rscopy = this.copy();
        rscopy.filteredrows = rscopy.filteredrows.splice(pos, rscopy.filteredrows.length);
        return rscopy;
    };
    Resultset.prototype.count = function () {
        // if this is chained resultset with no filters applied, just return collection.data
        if (this.searchIsChained && !this.filterInitialized) {
            if (this.filteredrows.length === 0) {
                return this.collection.data.length;
            }
            else {
                // filteredrows must have been set manually, so use it
                this.filterInitialized = true;
            }
        }
        return this.filteredrows.length;
    };
    /** To support reuse of resultset in branched query situations.
     *
     * @returns Returns a copy of the resultset (set) but the underlying document references will be the same.
     */
    Resultset.prototype.copy = function () {
        var result = Resultset.from(this.collection, null, null);
        result.filteredrows = this.filteredrows.slice();
        result.filterInitialized = this.filterInitialized;
        return result;
    };
    /** User supplied compare function is provided two documents to compare. (chainable)
     *   Example:
     *   rslt.sort(function(obj1, obj2) {
     *     if (obj1.name === obj2.name) return 0;
     *     if (obj1.name > obj2.name) return 1;
     *     if (obj1.name < obj2.name) return -1;
     *   });
     *
     * @param compareFunc An Array.sort() style compare function used for sorting.
     * @returns Reference to this resultset, sorted, for future chain operations.
     */
    Resultset.prototype.sort = function (compareFunc) {
        // if this is chained resultset with no filters applied, just we need to populate filteredrows first
        if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
            this.filteredrows = Object.keys(this.collection.data).map(_parseInt);
        }
        var coll = this.collection;
        this.filteredrows.sort(function comparer(a, b) {
            var obj1 = coll.data[a];
            var obj2 = coll.data[b];
            return compareFunc(obj1, obj2);
        });
        return this;
    };
    /** Simpler, loose evaluation for user to sort based on a property name. (chainable)
     *
     * @param propname name of property to sort by.
     * @param isdesc (Optional) If true, the property will be sorted in descending order
     * @returns Reference to this resultset, sorted, for future chain operations.
     */
    Resultset.prototype.simplesort = function (propname, isdesc) {
        // if this is chained resultset with no filters applied, just we need to populate filteredrows first
        if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
            this.filteredrows = Object.keys(this.collection.data).map(_parseInt);
        }
        if (typeof isdesc === "undefined") {
            isdesc = false;
        }
        var coll = this.collection;
        this.filteredrows.sort(function comparer(a, b) {
            var obj1 = coll.data[a];
            var obj2 = coll.data[b];
            return sortHelper(obj1[propname], obj2[propname], isdesc);
        });
        return this;
    };
    /** helper method for compoundsort(), performing individual object comparisons
     *
     * @param props array of property names, in order, by which to evaluate sort order
     * @param obj1 first object to compare
     * @param obj2 second object to compare
     * @returns 0, -1, or 1 to designate if identical (sortwise) or which should be first
     */
    Resultset.prototype.compoundeval = function (props, obj1, obj2) {
        var propCount = props.length;
        if (propCount === 0) {
            throw new Error("Invalid call to compoundeval, need at least one property");
        }
        // decode property, whether just a string property name or subarray [propname, isdesc]
        var isdesc = false;
        var firstProp = props[0];
        if (typeof firstProp !== "string" && Array.isArray(firstProp)) {
            isdesc = firstProp[1];
            firstProp = firstProp[0];
        }
        if (obj1[firstProp] === obj2[firstProp]) {
            if (propCount === 1) {
                return 0;
            }
            else {
                return this.compoundeval(props.slice(1), obj1, obj2);
            }
        }
        return sortHelper(obj1[firstProp], obj2[firstProp], isdesc);
    };
    /** Allows sorting a resultset based on multiple columns.
     *   Example : rs.compoundsort(['age', 'name']); to sort by age and then name (both ascending)
     *   Example : rs.compoundsort(['age', ['name', true]); to sort by age (ascending) and then by name (descending)
     *
     * @param properties array of property names or subarray of [propertyname, isdesc] used evaluate sort order
     * @returns Reference to this resultset, sorted, for future chain operations.
     */
    Resultset.prototype.compoundsort = function (properties) {
        var self = this;
        // if this is chained resultset with no filters applied, just we need to populate filteredrows first
        if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
            this.filteredrows = Object.keys(this.collection.data).map(_parseInt);
        }
        this.filteredrows.sort(function comparer(a, b) {
            var obj1 = self.collection.data[a];
            var obj2 = self.collection.data[b];
            return self.compoundeval(properties, obj1, obj2);
        });
        return this;
    };
    /** Oversee OR'ing query expressions.
     *   OR'ed expression evaluation runs each expression individually against the full collection,
     *   and finally does a set OR on each expression's results.
     *   Each evaluation can utilize a binary index to prevent multiple linear array scans.
     *
     * @param expressionArray array of expressions
     * @returns this resultset for further chain ops.
     */
    Resultset.prototype.findOr = function (expressionArray) {
        // if filter is already initialized we need to query against only those items already in filter.
        // This means no index utilization for fields, so hopefully its filtered to a smallish filteredrows.
        if (this.filterInitialized) {
            var docset = [];
            for (var ei = 0; ei < expressionArray.length; ei++) {
                // we need to branch existing query to run each filter separately and combine results
                var expBranchResults = this.branch();
                expBranchResults.find(expressionArray[ei]);
                expBranchResults.data();
                // add any document 'hits'
                var fr1 = expBranchResults.filteredrows;
                for (var fri = 0; fri < fr1.length; fri++) {
                    if (docset.indexOf(fr1[fri]) === -1) {
                        docset.push(fr1[fri]);
                    }
                }
            }
            this.filteredrows = docset;
        }
        else {
            for (var ei = 0; ei < expressionArray.length; ei++) {
                // we will let each filter run independently against full collection and mashup document hits later
                var expChainResults = this.collection.chain();
                expChainResults.find(expressionArray[ei]);
                expChainResults.data();
                // add any document 'hits'
                var fr2 = expChainResults.filteredrows;
                for (var fri = 0; fri < fr2.length; fri++) {
                    if (this.filteredrows.indexOf(fr2[fri]) === -1) {
                        this.filteredrows.push(fr2[fri]);
                    }
                }
            }
        }
        this.filterInitialized = true;
        // possibly sort indexes
        return this;
    };
    /** Oversee AND'ing query expressions.
     *   AND'ed expression evaluation runs each expression progressively against the full collection,
     *   internally utilizing existing chained resultset functionality.
     *   Only the first filter can utilize a binary index.
     *
     * @param expressionArray array of expressions
     * @returns this resultset for further chain ops.
     */
    Resultset.prototype.findAnd = function (expressionArray) {
        // we have already implementing chaining in this Resultset class
        // so we can just progressively apply user supplied filters
        for (var i = 0; i < expressionArray.length; i++) {
            this.find(expressionArray[i]);
        }
        return this;
    };
    Resultset.prototype.find = function (query, firstOnly) {
        if (this.collection.data.length === 0) {
            if (this.searchIsChained) {
                this.filteredrows = [];
                this.filterInitialized = true;
                return this;
            }
            return [];
        }
        if (this.collection.data === null) {
            throw new TypeError("cannot query collection with null data");
        }
        var queryObj = query || "getAll", property = null, value, operator = null, result = [], index = null, 
        // collection data
        dt, ix, emptyQO = true;
        // if this was not invoked via findOne()
        firstOnly = firstOnly || false;
        // if passed in empty object {}, interpret as 'getAll'
        // more performant than object.keys
        for (var p in queryObj) {
            emptyQO = false;
            break;
        }
        if (emptyQO) {
            queryObj = "getAll";
        }
        // apply no filters if they want all
        if (queryObj === "getAll") {
            // chained queries can just do coll.chain().data() but let's
            // be versatile and allow this also coll.chain().find().data()
            if (firstOnly) {
                if (this.filterInitialized) {
                    this.filteredrows = this.filteredrows.slice(0, 1);
                }
                else {
                    this.filteredrows = this.collection.data.length > 0 ? [0] : [];
                    this.filterInitialized = true;
                }
                if (this.searchIsChained) {
                    return this;
                }
                else {
                    return this.filteredrows.length > 0 ? this.collection.data[this.filteredrows[0]] : [];
                }
            }
            if (this.searchIsChained) {
                this.filteredrows = Object.keys(this.collection.data).map(_parseInt);
                return this;
            }
            // not chained, so return collection data array
            else {
                return this.collection.data;
            }
        }
        for (var p in queryObj) {
            if (queryObj.hasOwnProperty(p)) {
                property = p;
                var queryVal = queryObj[p];
                // injecting $and and $or expression tree evaluation here.
                if (p === "$and") {
                    if (this.searchIsChained) {
                        this.findAnd(queryVal);
                        // for chained find with firstonly,
                        if (firstOnly && this.filteredrows.length > 1) {
                            this.filteredrows = this.filteredrows.slice(0, 1);
                        }
                        return this;
                    }
                    else {
                        // the $and operation internally chains filters
                        result = this.collection.chain().findAnd(queryVal).data();
                        // if this was coll.findOne() return first object or empty array if null
                        // since this is invoked from a constructor we can't return null, so we will
                        // make null in coll.findOne();
                        if (firstOnly) {
                            if (result.length === 0)
                                return [];
                            return result[0];
                        }
                        // not first only return all results
                        return result;
                    }
                }
                if (p === "$or") {
                    if (this.searchIsChained) {
                        this.findOr(queryVal);
                        if (firstOnly && this.filteredrows.length > 1) {
                            this.filteredrows = this.filteredrows.slice(0, 1);
                        }
                        return this;
                    }
                    else {
                        // call out to helper function to determine $or results
                        result = this.collection.chain().findOr(queryVal).data();
                        if (firstOnly) {
                            if (result.length === 0)
                                return [];
                            return result[0];
                        }
                        // not first only return all results
                        return result;
                    }
                }
                if (typeof queryVal !== "object") {
                    operator = "$eq";
                    value = queryVal;
                }
                else if (typeof queryVal === "object") {
                    for (var key in queryVal) {
                        if (queryVal.hasOwnProperty(key)) {
                            operator = key;
                            value = queryVal[key];
                        }
                    }
                }
                else {
                    throw new Error("query property '" + p + "' value of type '" + (typeof queryVal) + "' is not supported.");
                }
                break;
            }
        }
        if (operator == null) {
            throw new Error("cannot find() without operator, query: " + query);
        }
        if (!(operator in Resultset.LokiOps)) {
            throw new Error("unknown find() query operator '" + operator + "' in query: " + query);
        }
        // for regex ops, precompile
        if (operator === "$regex")
            value = new RegExp(value);
        // if an index exists for the property being queried, use it for non-chained queries
        // (who's set of docs matches index) or chained queries where it is the first filter applied and prop is indexed
        if ((!this.searchIsChained || (this.searchIsChained && !this.filterInitialized)) &&
            operator !== "$ne" && operator !== "$regex" && operator !== "$contains" && operator !== "$containsAny" && operator !== "$in" && this.collection.binaryIndices.hasOwnProperty(property)) {
            // this is where lazy index rebuilding will take place
            // leave all indexes dirty until we need them and rebuild only the index tied to this property
            // ensureIndex() will only rebuild if flagged as dirty since we are not passing force=true
            this.collection.ensureIndex(property);
            index = this.collection.binaryIndices[property];
        }
        // the comparison function
        var op = operator;
        var fun = Resultset.LokiOps[op];
        // Query executed differently depending on:
        //    - whether it is chained or not
        //    - whether the property being queried has an index defined
        //    - if chained, we handle first pass differently for initial filteredrows[] population
        //
        // For performance reasons, each case has its own if block to minimize in-loop calculations
        // If not a chained query, bypass filteredrows and work directly against data
        if (!this.searchIsChained) {
            if (index == null) {
                dt = this.collection.data;
                var len = dt.length;
                if (firstOnly) {
                    for (var i = 0; i < len; i++) {
                        if (fun(dt[i][property], value)) {
                            return dt[i];
                        }
                    }
                    return [];
                }
                else {
                    for (var i = 0; i < len; i++) {
                        if (fun(dt[i][property], value)) {
                            result.push(dt[i]);
                        }
                    }
                }
            }
            else {
                // searching by binary index via calculateRange() utility method
                dt = this.collection.data;
                var seg = this.calculateRange(op, property, value);
                // not chained so this 'find' was designated in Resultset constructor so return object itself
                if (firstOnly) {
                    if (seg[1] !== -1) {
                        return dt[index.values[seg[0]]];
                    }
                    return [];
                }
                for (var i = seg[0]; i <= seg[1]; i++) {
                    result.push(dt[index.values[i]]);
                }
                // TODO is this correct
                this.filteredrows = index.values.slice(seg[0], seg[1] + 1);
            }
            // not a chained query so return result as data[]
            return result;
        }
        // Otherwise this is a chained query
        else {
            // If the filteredrows[] is already initialized, use it
            if (this.filterInitialized) {
                var res = [];
                // not searching by index
                if (index == null) {
                    dt = this.collection.data;
                    var len = this.filteredrows.length;
                    for (var i = 0; i < len; i++) {
                        if (fun(dt[this.filteredrows[i]][property], value)) {
                            res.push(this.filteredrows[i]);
                            if (firstOnly) {
                                break;
                            }
                        }
                    }
                }
                else {
                    // search by index
                    ix = index;
                    var len = this.filteredrows.length;
                    for (var i = 0; i < len; i++) {
                        // TODO probably doesn't work
                        if (fun(ix[this.filteredrows[i]], value)) {
                            res.push(this.filteredrows[i]);
                            if (firstOnly) {
                                break;
                            }
                        }
                    }
                }
                this.filteredrows = res;
            }
            // first chained query so work against data[] but put results in filteredrows
            else {
                var res = [];
                dt = this.collection.data;
                // if not searching by index
                if (index == null) {
                    var len = dt.length;
                    for (var i = 0; i < len; i++) {
                        if (fun(dt[i][property], value)) {
                            res.push(i);
                            if (firstOnly) {
                                break;
                            }
                        }
                    }
                }
                else {
                    // search by index
                    var segm = this.calculateRange(op, property, value);
                    if (firstOnly) {
                        // return without updating filteredrows because 
                        if (segm[1] !== -1) {
                            res.push(index.values[segm[0]]);
                        }
                    }
                    else {
                        for (var idx = segm[0]; idx <= segm[1]; idx++) {
                            res.push(index.values[idx]);
                        }
                    }
                }
                this.filteredrows = res;
                this.filterInitialized = true; // next time work against filteredrows[]
            }
            return this;
        }
    };
    /** Used for filtering via a javascript filter function.
     *
     * @param searchFunc A javascript function used for filtering current results by.
     * @returns this resultset for further chain ops.
     */
    Resultset.prototype.where = function (searchFunc) {
        var collData = this.collection.data;
        // if not a chained query then run directly against data[] and return object[]
        if (!this.searchIsChained) {
            var result = [];
            var i = collData.length;
            while (i--) {
                if (searchFunc(collData[i]) === true) {
                    result.push(collData[i]);
                }
            }
            // not a chained query so returning result as data[]
            return result;
        }
        // else chained query, so run against filteredrows
        else {
            // If the filteredrows[] is already initialized, use it
            if (this.filterInitialized) {
                var rows = [];
                var j = this.filteredrows.length;
                while (j--) {
                    if (searchFunc(collData[this.filteredrows[j]]) === true) {
                        rows.push(this.filteredrows[j]);
                    }
                }
                this.filteredrows = rows;
                return this;
            }
            // otherwise this is initial chained op, work against data, push into filteredrows[]
            else {
                var idxs = [];
                var k = collData.length;
                while (k--) {
                    if (searchFunc(collData[k]) === true) {
                        idxs.push(k);
                    }
                }
                this.filteredrows = idxs;
                this.filterInitialized = true;
                return this;
            }
        }
    };
    /** Terminates the chain and returns array of filtered documents
     *
     * @returns Array of documents in the resultset
     */
    Resultset.prototype.data = function (options) {
        var data = this.collection.data;
        var cloneFunc = options != null && typeof options.clone === "string" ? CloneUtil.getCloneFunc(options.clone) :
            (this.collection.cloneObjects ? this.collection.cloneFunc :
                (options != null && options.clone === true ? CloneUtil.cloneParseStringify : null));
        // if this is chained resultset with no filters applied, just return collection.data
        if (this.searchIsChained && !this.filterInitialized) {
            if (this.filteredrows.length === 0) {
                // determine whether we need to clone objects
                if (cloneFunc != null) {
                    var results = [];
                    for (var i = 0, size = data.length; i < size; i++) {
                        results.push(cloneFunc(data[i]));
                    }
                    return results;
                }
                else {
                    return data;
                }
            }
            else {
                // filteredrows must have been set manually, so use it
                this.filterInitialized = true;
            }
        }
        var fr = this.filteredrows;
        var len = this.filteredrows.length;
        var result = [];
        if (cloneFunc != null) {
            for (var i = 0; i < len; i++) {
                var rowCopy = cloneFunc(data[fr[i]]);
                result.push(rowCopy);
            }
        }
        else {
            for (var i = 0; i < len; i++) {
                result.push(data[fr[i]]);
            }
        }
        return result;
    };
    /** used to run an update operation on all documents currently in the resultset.
     *
     * @param updateFunc User supplied updateFunction(obj) will be executed for each document object.
     * @returns this resultset for further chain ops.
     */
    Resultset.prototype.update = function (updateFunc) {
        // if this is chained resultset with no filters applied, we need to populate filteredrows first
        if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
            this.filteredrows = Object.keys(this.collection.data).map(_parseInt);
        }
        var len = this.filteredrows.length, rcd = this.collection.data;
        for (var i = 0; i < len; i++) {
            var idx = this.filteredrows[i];
            var res = updateFunc(rcd[idx]);
            // pass in each document object currently in resultset to user supplied updateFunction
            if (res !== undefined) {
                rcd[idx] = res;
            }
            // notify collection we have changed this object so it can update meta and allow DynamicViews to re-evaluate
            this.collection.update(rcd[idx]);
        }
        return this;
    };
    /** removes all document objects which are currently in resultset from collection (as well as resultset)
     *
     * @returns this (empty) resultset for further chain ops.
     */
    Resultset.prototype.remove = function () {
        // if this is chained resultset with no filters applied, we need to populate filteredrows first
        if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
            this.filteredrows = Object.keys(this.collection.data).map(_parseInt);
        }
        var len = this.filteredrows.length;
        for (var idx = 0; idx < len; idx++) {
            this.collection.remove(this.filteredrows[idx]);
        }
        this.filteredrows = [];
        return this;
    };
    Resultset.prototype.map = function (mapFun, options) {
        var data = this.data(options).map(mapFun);
        // return a new resultset with no filters
        this.collection = Resultset.newCollection("mappedData");
        this.collection.insert(data);
        this.filteredrows = [];
        this.filterInitialized = false;
        return this;
    };
    /** Binary Search utility method to find range/segment of values matching criteria.
     *   this is used for collection.find() and first find filter of resultset/dynview
     *   slightly different than get() binary search in that get() hones in on 1 value,
     *   but we have to hone in on many (range)
     * @param op operation, such as $eq
     * @param prop name of property to calculate range for
     * @param val value to use for range calculation.
     * @returns [start, end] index array positions
     */
    Resultset.prototype.calculateRange = function (op, prop, val) {
        var rcd = this.collection.data;
        var index = this.collection.binaryIndices[prop].values;
        var min = 0;
        var max = index.length - 1;
        var mid = null;
        var lbound = 0;
        var ubound = index.length - 1;
        // when no documents are in collection, return empty range condition
        if (rcd.length === 0) {
            return [0, -1];
        }
        var minVal = rcd[index[min]][prop];
        var maxVal = rcd[index[max]][prop];
        // if value falls outside of our range return [0, -1] to designate no results
        switch (op) {
            case "$eq":
                if (ltHelper(val, minVal) || gtHelper(val, maxVal)) {
                    return [0, -1];
                }
                break;
            case "$gt":
                if (gtHelper(val, maxVal, true)) {
                    return [0, -1];
                }
                break;
            case "$gte":
                if (gtHelper(val, maxVal)) {
                    return [0, -1];
                }
                break;
            case "$lt":
                if (ltHelper(val, minVal, true)) {
                    return [0, -1];
                }
                break;
            case "$lte":
                if (ltHelper(val, minVal)) {
                    return [0, -1];
                }
                break;
        }
        // hone in on start position of value
        while (min < max) {
            mid = Math.floor((min + max) / 2);
            if (ltHelper(rcd[index[mid]][prop], val)) {
                min = mid + 1;
            }
            else {
                max = mid;
            }
        }
        lbound = min;
        min = 0;
        max = index.length - 1;
        // hone in on end position of value
        while (min < max) {
            mid = Math.floor((min + max) / 2);
            if (ltHelper(val, rcd[index[mid]][prop])) {
                max = mid;
            }
            else {
                min = mid + 1;
            }
        }
        ubound = max;
        var lval = rcd[index[lbound]][prop];
        var uval = rcd[index[ubound]][prop];
        switch (op) {
            case "$eq":
                if (lval !== val) {
                    return [0, -1];
                }
                if (uval !== val) {
                    ubound--;
                }
                return [lbound, ubound];
            case "$aeq":
                if (lval != val) {
                    return [0, -1];
                }
                if (uval != val) {
                    ubound--;
                }
                return [lbound, ubound];
            case "$gt":
                if (ltHelper(uval, val, true)) {
                    return [0, -1];
                }
                return [ubound, rcd.length - 1];
            case "$gte":
                if (ltHelper(lval, val)) {
                    return [0, -1];
                }
                return [lbound, rcd.length - 1];
            case "$lt":
                if (lbound === 0 && ltHelper(lval, val)) {
                    return [0, 0];
                }
                return [0, lbound - 1];
            case "$lte":
                if (uval !== val) {
                    ubound--;
                }
                if (ubound === 0 && ltHelper(uval, val)) {
                    return [0, 0];
                }
                return [0, ubound];
            default:
                return [0, rcd.length - 1];
        }
    };
    Resultset.from = function (collection, queryObj, queryFunc, firstOnly) {
        var inst = new Resultset(collection, queryObj, queryFunc);
        // if user supplied initial queryObj or queryFunc, apply it
        if (queryObj != null) {
            return inst.find(queryObj, firstOnly);
        }
        if (queryFunc != null) {
            return inst.where(queryFunc);
        }
        // otherwise return unfiltered Resultset for future filtering
        return inst;
    };
    return Resultset;
}());
(function (Resultset) {
    Resultset.LokiOps = {
        // comparison operators
        $eq: function (a, b) {
            return a === b;
        },
        $aeq: function (a, b) {
            return a == b;
        },
        $gt: function (a, b) {
            return gtHelper(a, b);
        },
        $gte: function (a, b) {
            return gtHelper(a, b, true);
        },
        $lt: function (a, b) {
            return ltHelper(a, b);
        },
        $lte: function (a, b) {
            return ltHelper(a, b, true);
        },
        $ne: function (a, b) {
            return a !== b;
        },
        $regex: function (a, b) {
            return b.test(a);
        },
        $in: function (a, b) {
            return b.indexOf(a) > -1;
        },
        $contains: function (a, b) {
            if (!Array.isArray(b)) {
                b = [b];
            }
            var checkFn = containsCheckFn(a);
            return b.reduce(function (prev, curr) {
                if (!prev) {
                    return prev;
                }
                return checkFn(curr);
            }, true);
        },
        $containsAny: function (a, b) {
            if (!Array.isArray(b)) {
                b = [b];
            }
            var checkFn = containsCheckFn(a);
            return b.reduce(function (prev, curr) {
                if (prev) {
                    return prev;
                }
                return checkFn(curr);
            }, false);
        }
    };
})(Resultset || (Resultset = {}));
function _parseInt(num) {
    return parseInt(num);
}
// Sort helper that support null and undefined
function ltHelper(prop1, prop2, equal) {
    if (prop1 === prop2) {
        if (equal) {
            return true;
        }
        else {
            return false;
        }
    }
    if (prop1 == null) {
        return true;
    }
    if (prop2 == null) {
        return false;
    }
    return equal ? prop1 <= prop2 : prop1 < prop2;
}
function gtHelper(prop1, prop2, equal) {
    if (prop1 === prop2) {
        if (equal) {
            return true;
        }
        else {
            return false;
        }
    }
    if (prop1 == null) {
        return false;
    }
    if (prop2 == null) {
        return true;
    }
    return equal ? prop1 >= prop2 : prop1 > prop2;
}
function sortHelper(prop1, prop2, desc) {
    if (prop1 === prop2) {
        return 0;
    }
    if (desc) {
        return ltHelper(prop1, prop2) ? 1 : -1;
    }
    else {
        return gtHelper(prop1, prop2) ? 1 : -1;
    }
}
function containsCheckFn(a) {
    if (Array.isArray(a)) {
        return function (curr) {
            return a.indexOf(curr) !== -1;
        };
    }
    else if (typeof a === "string") {
        return function (curr) {
            return a.indexOf(curr) !== -1;
        };
    }
    else if (a != null && typeof a === "object") {
        return function (curr) {
            return a.hasOwnProperty(curr);
        };
    }
    else {
        throw new Error("Argument 'a' must be an array, string, or non-null object: " + a);
    }
}
module.exports = Resultset;
